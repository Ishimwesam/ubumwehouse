const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

const normalizeAvailableFloors = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch (_) {
      return [trimmed];
    }
  }

  return [];
};

const normalizeText = (value, maxLength = 120) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);

// Get all buildings
const getAllBuildings = (req, res) => {
  db.all('SELECT * FROM buildings ORDER BY created_at DESC', [], (err, buildings) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching buildings' });
    }

    res.json(buildings);
  });
};

// Get building by ID
const getBuildingById = (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM buildings WHERE id = ?', [id], (err, building) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching building' });
    }

    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    res.json(building);
  });
};

// Create building
const createBuilding = (req, res) => {
  const { name, address, city, country, total_floors, available_floors } = req.body;
  const normalizedName = normalizeText(name);

  if (!normalizedName) {
    return res.status(400).json({ error: 'Building name is required' });
  }

  const normalizedFloorsList = normalizeAvailableFloors(available_floors);
  if (normalizedFloorsList.length === 0) {
    return res.status(400).json({ error: 'Select at least one available floor' });
  }

  const buildingId = uuidv4();
  const normalizedFloors = JSON.stringify(normalizedFloorsList);

  db.get('SELECT id FROM buildings WHERE LOWER(name) = LOWER(?) LIMIT 1', [normalizedName], (duplicateErr, duplicate) => {
    if (duplicateErr) return res.status(500).json({ error: 'Error checking duplicate building' });
    if (duplicate) return res.status(409).json({ error: 'A building with this name already exists' });

    db.run(
      'INSERT INTO buildings (id, name, address, city, country, total_floors, available_floors) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        buildingId,
        normalizedName,
        normalizeText(address, 180),
        normalizeText(city),
        normalizeText(country),
        normalizedFloorsList.length || total_floors || 1,
        normalizedFloors
      ],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating building' });
        }

        res.status(201).json({
          message: 'Building created successfully',
          building: {
            id: buildingId,
            name: normalizedName,
            address: normalizeText(address, 180),
            city: normalizeText(city),
            country: normalizeText(country),
            total_floors: normalizedFloorsList.length || total_floors || 1,
            available_floors: normalizedFloorsList
          }
        });
      }
    );
  });
};

const updateBuildingRecord = ({ id, normalizedName, address, city, country, total_floors, normalizedFloorsList, normalizedFloors }, res) => {
  db.run(
    'UPDATE buildings SET name = ?, address = ?, city = ?, country = ?, total_floors = ?, available_floors = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [normalizedName, normalizeText(address, 180), normalizeText(city), normalizeText(country), normalizedFloorsList.length || total_floors || 1, normalizedFloors, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating building' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Building not found' });
      }

      res.json({ message: 'Building updated successfully' });
    }
  );
};

// Update building
const updateBuilding = (req, res) => {
  const { id } = req.params;
  const { name, address, city, country, total_floors, available_floors } = req.body;
  const normalizedName = normalizeText(name);
  if (!normalizedName) {
    return res.status(400).json({ error: 'Building name is required' });
  }

  const normalizedFloorsList = normalizeAvailableFloors(available_floors);
  if (normalizedFloorsList.length === 0) {
    return res.status(400).json({ error: 'Select at least one available floor' });
  }

  const normalizedFloors = JSON.stringify(normalizedFloorsList);

  db.get('SELECT id FROM buildings WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1', [normalizedName, id], (duplicateErr, duplicate) => {
    if (duplicateErr) return res.status(500).json({ error: 'Error checking duplicate building' });
    if (duplicate) return res.status(409).json({ error: 'A building with this name already exists' });

    updateBuildingRecord({ id, normalizedName, address, city, country, total_floors, normalizedFloorsList, normalizedFloors }, res);
  });
};

// Delete building
const deleteBuilding = (req, res) => {
  const { id } = req.params;

  db.get('SELECT COUNT(*) as unitCount FROM units WHERE building_id = ?', [id], (countErr, row) => {
    if (countErr) return res.status(500).json({ error: 'Error validating building deletion' });
    if (parseInt(row?.unitCount || 0, 10) > 0) {
      return res.status(400).json({ error: 'Cannot delete a building that still has units. Move or delete the units first.' });
    }

    db.run('DELETE FROM buildings WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error deleting building' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Building not found' });
      }

      res.json({ message: 'Building deleted successfully' });
    });
  });
};

const updateBuildingImage = (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'Choose a building image before uploading.' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;

  db.run(
    'UPDATE buildings SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [imageUrl, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating building image' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Building not found' });
      }

      db.get('SELECT * FROM buildings WHERE id = ?', [id], (getErr, building) => {
        if (getErr || !building) {
          return res.status(500).json({ error: 'Building image updated, but failed to fetch building' });
        }

        return res.json({ message: 'Building image updated successfully', building });
      });
    }
  );
};

module.exports = {
  getAllBuildings,
  getBuildingById,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  updateBuildingImage
};
