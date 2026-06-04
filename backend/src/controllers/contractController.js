const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

const lifecycleStatusSql = `
  CASE
    WHEN COALESCE(c.status, '') = 'terminated' THEN 'terminated'
    WHEN COALESCE(c.status, '') = 'active' AND DATE(c.contract_end) < DATE('now') THEN 'ended'
    WHEN COALESCE(c.status, '') = 'active' THEN 'active'
    ELSE 'others'
  END
`;

const isDateBeforeToday = (dateValue) => {
  if (!dateValue) return false;
  const today = new Date().toISOString().slice(0, 10);
  return String(dateValue) < today;
};
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const normalizeNotes = (value) => String(value || '').trim().slice(0, 1000);

const getAllContracts = (req, res) => {
  const { status } = req.query;
  const filters = [];
  let whereClause = '';

  if (status === 'active' || status === 'ended' || status === 'terminated' || status === 'others') {
    whereClause = `WHERE ${lifecycleStatusSql} = ?`;
    filters.push(status);
  }

  db.all(
    `SELECT c.*, ${lifecycleStatusSql} as lifecycle_status,
            t.full_name as tenant_name, u.unit_number, b.name as building_name
     FROM contracts c
     LEFT JOIN tenants t ON c.tenant_id = t.id
     LEFT JOIN units u ON c.unit_id = u.id
     LEFT JOIN buildings b ON u.building_id = b.id
     ${whereClause}
     ORDER BY c.created_at DESC`,
    filters,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching contracts' });
      }

      res.json(rows || []);
    }
  );
};

const getContractsByTenant = (req, res) => {
  const { tenantId } = req.params;

  db.all(
    `SELECT c.*, ${lifecycleStatusSql} as lifecycle_status,
            t.full_name as tenant_name, u.unit_number, b.name as building_name
     FROM contracts c
     LEFT JOIN tenants t ON c.tenant_id = t.id
     LEFT JOIN units u ON c.unit_id = u.id
     LEFT JOIN buildings b ON u.building_id = b.id
     WHERE c.tenant_id = ?
     ORDER BY c.created_at DESC`,
    [tenantId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching tenant contracts' });
      }

      res.json(rows || []);
    }
  );
};

const createContract = (req, res) => {
  const { tenant_id, unit_id, contract_start, contract_end, notes } = req.body;

  if (!tenant_id || !unit_id || !contract_start || !contract_end) {
    return res.status(400).json({ error: 'Tenant, unit, contract start and contract end are required' });
  }

  if (!isValidDate(contract_start) || !isValidDate(contract_end)) {
    return res.status(400).json({ error: 'Contract dates must use YYYY-MM-DD format' });
  }

  if (contract_end < contract_start) {
    return res.status(400).json({ error: 'Contract end date must be after start date' });
  }

  const documentPath = req.file ? `/uploads/${req.file.filename}` : null;

  db.get(
    `SELECT id, contract_end FROM contracts
     WHERE status = 'active' AND (tenant_id = ? OR unit_id = ?)
     LIMIT 1`,
    [tenant_id, unit_id],
    (activeErr, activeContract) => {
      if (activeErr) {
        return res.status(500).json({ error: 'Error validating active contract' });
      }

      if (activeContract && !isDateBeforeToday(activeContract.contract_end)) {
        return res.status(400).json({
          error: 'An active contract already exists. Terminate the current contract before renewal.'
        });
      }

      const continueCreate = () => {
        db.get(
          `SELECT t.id
           FROM tenants t
           WHERE t.id = ? AND t.unit_id = ? AND t.status = 'active'`,
          [tenant_id, unit_id],
          (tenantErr, tenant) => {
            if (tenantErr) {
              return res.status(500).json({ error: 'Error validating tenant assignment' });
            }

            if (!tenant) {
              return res.status(400).json({
                error: 'Tenant must be active and assigned to the selected unit before creating a contract'
              });
            }

            const contractId = uuidv4();

            db.run(
              `INSERT INTO contracts (
                id, tenant_id, unit_id, contract_start, contract_end, status, contract_file_path, notes
              ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
              [
                contractId,
                tenant_id,
                unit_id,
                contract_start,
                contract_end,
                documentPath,
                normalizeNotes(notes)
              ],
              function(insertErr) {
                if (insertErr) {
                  return res.status(500).json({ error: 'Error creating contract' });
                }

                res.status(201).json({
                  message: 'Contract created successfully',
                  contract: {
                    id: contractId,
                    tenant_id,
                    unit_id,
                    contract_start,
                    contract_end,
                    status: 'active',
                    contract_file_path: documentPath,
                    notes: normalizeNotes(notes)
                  }
                });
              }
            );
          }
        );
      };

      if (!activeContract || !isDateBeforeToday(activeContract.contract_end)) {
        return continueCreate();
      }

      db.run(
        `UPDATE contracts
         SET status = 'terminated',
             terminated_at = CURRENT_TIMESTAMP,
             termination_reason = COALESCE(NULLIF(termination_reason, ''), 'Auto-terminated during renewal after end date'),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [activeContract.id],
        (autoTerminateErr) => {
          if (autoTerminateErr) {
            return res.status(500).json({ error: 'Error preparing expired contract for renewal' });
          }

          return continueCreate();
        }
      );
    }
  );
};

const updateContract = (req, res) => {
  const { id } = req.params;
  const { tenant_id, unit_id, contract_start, contract_end, notes } = req.body;

  if (!tenant_id || !unit_id || !contract_start || !contract_end) {
    return res.status(400).json({ error: 'Tenant, unit, contract start and contract end are required' });
  }

  if (!isValidDate(contract_start) || !isValidDate(contract_end)) {
    return res.status(400).json({ error: 'Contract dates must use YYYY-MM-DD format' });
  }

  if (contract_end < contract_start) {
    return res.status(400).json({ error: 'Contract end date must be after start date' });
  }

  db.get(
    `SELECT * FROM contracts WHERE id = ?`,
    [id],
    (findErr, existingContract) => {
      if (findErr) {
        return res.status(500).json({ error: 'Error updating contract' });
      }

      if (!existingContract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      db.get(
        `SELECT id, contract_end
         FROM contracts
         WHERE status = 'active'
           AND id != ?
           AND (tenant_id = ? OR unit_id = ?)
         LIMIT 1`,
        [id, tenant_id, unit_id],
        (activeErr, activeContract) => {
          if (activeErr) {
            return res.status(500).json({ error: 'Error validating active contract' });
          }

          if (activeContract && !isDateBeforeToday(activeContract.contract_end)) {
            return res.status(400).json({
              error: 'Another active contract already exists for this tenant or unit.'
            });
          }

          const nextFilePath = req.file
            ? `/uploads/${req.file.filename}`
            : existingContract.contract_file_path;

          db.run(
            `UPDATE contracts
             SET tenant_id = ?,
                 unit_id = ?,
                 contract_start = ?,
                 contract_end = ?,
                 contract_file_path = ?,
                 notes = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              tenant_id,
              unit_id,
              contract_start,
              contract_end,
              nextFilePath,
              normalizeNotes(notes),
              id
            ],
            function(updateErr) {
              if (updateErr) {
                return res.status(500).json({ error: 'Error updating contract' });
              }

              res.json({
                message: 'Contract updated successfully',
                contract: {
                  ...existingContract,
                  tenant_id,
                  unit_id,
                  contract_start,
                  contract_end,
                  contract_file_path: nextFilePath,
                  notes: normalizeNotes(notes)
                }
              });
            }
          );
        }
      );
    }
  );
};

const terminateContract = (req, res) => {
  const { id } = req.params;
  const { termination_reason } = req.body;
  const normalizedReason = normalizeNotes(termination_reason);

  if (!normalizedReason) {
    return res.status(400).json({ error: 'Termination reason is required' });
  }

  db.get('SELECT id, status FROM contracts WHERE id = ?', [id], (findErr, contract) => {
    if (findErr) {
      return res.status(500).json({ error: 'Error terminating contract' });
    }

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    if (contract.status === 'terminated') {
      return res.status(400).json({ error: 'Contract is already terminated' });
    }

    db.run(
      `UPDATE contracts
       SET status = 'terminated', terminated_at = CURRENT_TIMESTAMP,
           termination_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [normalizedReason, id],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Error terminating contract' });
        }

        res.json({ message: 'Contract terminated successfully' });
      }
    );
  });
};

const deleteContract = (req, res) => {
  const { id } = req.params;

  db.get('SELECT id FROM contracts WHERE id = ?', [id], (findErr, contract) => {
    if (findErr) {
      return res.status(500).json({ error: 'Error deleting contract' });
    }

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    db.run('DELETE FROM contracts WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) {
        return res.status(500).json({ error: 'Error deleting contract' });
      }

      res.json({ message: 'Contract deleted successfully' });
    });
  });
};

module.exports = {
  getAllContracts,
  getContractsByTenant,
  createContract,
  updateContract,
  terminateContract,
  deleteContract
};
