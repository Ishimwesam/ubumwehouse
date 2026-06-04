const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const { createRentChangeForUnitTenants } = require('../services/rentHistoryService');

const derivedStatusExpression = `
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM tenants t
      WHERE t.unit_id = u.id AND t.status = 'active'
    ) THEN 'occupied'
    WHEN COALESCE(u.status, 'available') = 'maintenance' THEN 'maintenance'
    ELSE 'available'
  END
`;

const getActiveTenantCount = (unitId, callback) => {
  db.get(
    `SELECT COUNT(*) as activeTenantCount
     FROM tenants
     WHERE unit_id = ? AND status = 'active'`,
    [unitId],
    (err, row) => {
      if (err) {
        callback(err);
        return;
      }

      callback(null, parseInt(row?.activeTenantCount || 0, 10));
    }
  );
};

const normalizeText = (value, maxLength = 120) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
const normalizeRent = (value) => {
  const rent = parseFloat(value);
  return Number.isFinite(rent) && rent >= 0 ? rent : null;
};

// Get all units
const getAllUnits = (req, res) => {
  db.all(`
    SELECT u.id, u.building_id, u.unit_number, u.unit_type, u.monthly_rent, u.floor,
           u.created_at, u.updated_at, u.status as manual_status,
           ${derivedStatusExpression} as status,
           b.name as building_name, b.total_floors as building_total_floors
    FROM units u 
    LEFT JOIN buildings b ON u.building_id = b.id 
    ORDER BY u.created_at DESC
  `, [], (err, units) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching units' });
    }

    res.json(units);
  });
};

// Get units by building
const getUnitsByBuilding = (req, res) => {
  const { buildingId } = req.params;

  db.all(`
    SELECT u.id, u.building_id, u.unit_number, u.unit_type, u.monthly_rent, u.floor,
           u.created_at, u.updated_at, u.status as manual_status,
           ${derivedStatusExpression} as status,
           b.name as building_name, b.total_floors as building_total_floors
    FROM units u 
    LEFT JOIN buildings b ON u.building_id = b.id 
    WHERE u.building_id = ?
    ORDER BY u.floor, u.unit_number
  `, [buildingId], (err, units) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching units' });
    }

    res.json(units);
  });
};

// Get unit by ID
const getUnitById = (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT u.id, u.building_id, u.unit_number, u.unit_type, u.monthly_rent, u.floor,
           u.created_at, u.updated_at, u.status as manual_status,
           ${derivedStatusExpression} as status,
           b.name as building_name, b.total_floors as building_total_floors
    FROM units u 
    LEFT JOIN buildings b ON u.building_id = b.id 
    WHERE u.id = ?
  `, [id], (err, unit) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching unit' });
    }

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.json(unit);
  });
};

// Create unit
const createUnit = (req, res) => {
  const { building_id, unit_number, unit_type, monthly_rent, floor } = req.body;
  const normalizedUnitNumber = normalizeText(unit_number);
  const normalizedRent = normalizeRent(monthly_rent);

  if (!building_id || !normalizedUnitNumber) {
    return res.status(400).json({ error: 'Building ID and unit number are required' });
  }

  if (normalizedRent === null) {
    return res.status(400).json({ error: 'Monthly rent must be a valid number' });
  }

  const unitId = uuidv4();
  const selectedFloor = normalizeText(floor || 'GROUND FLOOR');

  db.get(
    'SELECT id FROM units WHERE building_id = ? AND LOWER(unit_number) = LOWER(?) LIMIT 1',
    [building_id, normalizedUnitNumber],
    (duplicateErr, duplicate) => {
      if (duplicateErr) return res.status(500).json({ error: 'Error checking duplicate unit' });
      if (duplicate) return res.status(409).json({ error: 'This unit number already exists in the selected building' });

      db.run(
        'INSERT INTO units (id, building_id, unit_number, unit_type, monthly_rent, status, floor) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [unitId, building_id, normalizedUnitNumber, normalizeText(unit_type), normalizedRent, 'available', selectedFloor],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating unit' });
          }

          res.status(201).json({
            message: 'Unit created successfully',
            unit: { id: unitId, building_id, unit_number: normalizedUnitNumber, unit_type: normalizeText(unit_type), monthly_rent: normalizedRent, status: 'available', floor: selectedFloor }
          });
        }
      );
    }
  );
};

// Update unit
const updateUnit = (req, res) => {
  const { id } = req.params;
  const { unit_number, unit_type, monthly_rent, status, floor } = req.body;
  const normalizedUnitNumber = normalizeText(unit_number);
  const normalizedRent = normalizeRent(monthly_rent);

  if (!normalizedUnitNumber) {
    return res.status(400).json({ error: 'Unit number is required' });
  }

  if (normalizedRent === null) {
    return res.status(400).json({ error: 'Monthly rent must be a valid number' });
  }

  db.get('SELECT id, monthly_rent FROM units WHERE id = ?', [id], (findErr, unit) => {
    if (findErr) {
      return res.status(500).json({ error: 'Error updating unit' });
    }

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    if (status === 'occupied') {
      return res.status(400).json({
        error: 'Occupied status is managed automatically from active tenant assignments'
      });
    }

    getActiveTenantCount(id, (countErr, activeTenantCount) => {
      if (countErr) {
        return res.status(500).json({ error: 'Error validating unit occupancy' });
      }

      let nextStatus = 'available';
      const selectedFloor = normalizeText(floor || 'GROUND FLOOR');

      if (activeTenantCount > 0) {
        nextStatus = 'occupied';
      } else if (status === 'maintenance') {
        nextStatus = 'maintenance';
      }

      db.get('SELECT building_id FROM units WHERE id = ?', [id], (buildingErr, currentUnit) => {
        if (buildingErr) return res.status(500).json({ error: 'Error checking unit building' });

        db.get(
          'SELECT id FROM units WHERE building_id = ? AND LOWER(unit_number) = LOWER(?) AND id != ? LIMIT 1',
          [currentUnit?.building_id, normalizedUnitNumber, id],
          (duplicateErr, duplicate) => {
            if (duplicateErr) return res.status(500).json({ error: 'Error checking duplicate unit' });
            if (duplicate) return res.status(409).json({ error: 'This unit number already exists in the selected building' });

            db.run(
              'UPDATE units SET unit_number = ?, unit_type = ?, monthly_rent = ?, status = ?, floor = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [normalizedUnitNumber, normalizeText(unit_type), normalizedRent, nextStatus, selectedFloor, id],
              function(err) {
                if (err) {
                  return res.status(500).json({ error: 'Error updating unit' });
                }

                const rentChanged = parseFloat(unit.monthly_rent || 0) !== normalizedRent;
                if (!rentChanged) {
                  res.json({ message: 'Unit updated successfully' });
                  return;
                }

                createRentChangeForUnitTenants({ unitId: id, amount: normalizedRent }, (rentErr) => {
                  if (rentErr) {
                    return res.status(500).json({ error: 'Unit updated, but tenant rent history could not be updated' });
                  }

                  res.json({ message: 'Unit updated successfully' });
                });
              }
            );
          }
        );
      });
    });
  });
};

// Delete unit
const deleteUnit = (req, res) => {
  const { id } = req.params;

  getActiveTenantCount(id, (countErr, activeTenantCount) => {
    if (countErr) return res.status(500).json({ error: 'Error validating unit deletion' });
    if (activeTenantCount > 0) {
      return res.status(400).json({ error: 'Cannot delete a unit with active tenants. Move the tenant out first.' });
    }

    db.run('DELETE FROM units WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error deleting unit' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Unit not found' });
      }

      res.json({ message: 'Unit deleted successfully' });
    });
  });
};

module.exports = {
  getAllUnits,
  getUnitsByBuilding,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit
};
