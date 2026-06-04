const API_URL = 'http://localhost:5003/api';
const ADMIN = { username: 'admin', password: 'admin123' };
const now = Date.now();

const qa = {
  buildingName: `QA API Building ${now}`,
  unitNumber: `QAAPI-${now}`,
  tenantName: `QA API Tenant ${now}`,
  tenantEmail: `qa.api.${now}@example.com`,
  tenantPhone: `078${String(now).slice(-7)}`,
  tenantNationalId: `${String(now).padEnd(16, '4').slice(0, 16)}`,
  contractNote: `QA API Contract ${now}`,
  paymentNote: `QA API Payment ${now}`
};

const request = async (path, { method = 'GET', token, json } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: json ? JSON.stringify(json) : undefined
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, data };
};

const result = { findings: [], steps: [] };
let token;
let buildingId;
let unitId;
let tenantId;
let contractId;
let paymentId;

try {
  const login = await request('/auth/login', {
    method: 'POST',
    json: { username: ADMIN.username, password: ADMIN.password }
  });
  if (!login.response.ok) throw new Error(`Login failed: ${login.response.status}`);
  token = login.data.token;

  const building = await request('/buildings', {
    method: 'POST',
    token,
    json: {
      name: qa.buildingName,
      address: 'QA Address',
      city: 'Kigali',
      country: 'Rwanda',
      total_floors: 1,
      available_floors: ['GROUND FLOOR']
    }
  });
  if (!building.response.ok) throw new Error(`Building create failed: ${building.response.status}`);
  buildingId = building.data.building.id;
  result.steps.push({ step: 'building_create', ok: true });

  const unit = await request('/units', {
    method: 'POST',
    token,
    json: {
      building_id: buildingId,
      unit_number: qa.unitNumber,
      unit_type: 'room',
      monthly_rent: 20000,
      floor: 'GROUND FLOOR'
    }
  });
  if (!unit.response.ok) throw new Error(`Unit create failed: ${unit.response.status}`);
  unitId = unit.data.unit.id;
  result.steps.push({ step: 'unit_create', ok: true });

  const tenant = await request('/tenants', {
    method: 'POST',
    token,
    json: {
      full_name: qa.tenantName,
      email: qa.tenantEmail,
      phone: qa.tenantPhone,
      national_id: qa.tenantNationalId,
      identification_document: 'QA-DOC',
      address: 'QA Address',
      occupation_status: 'Employed',
      occupation_place: 'QA Office',
      emergency_contact_name: 'QA Emergency',
      emergency_contact_phone: '0780000003',
      unit_id: unitId,
      move_in_date: new Date().toISOString().slice(0, 10)
    }
  });
  if (!tenant.response.ok) throw new Error(`Tenant create failed: ${tenant.response.status}`);
  tenantId = tenant.data.tenant.id;
  result.steps.push({ step: 'tenant_create', ok: true });

  const contract = await request('/contracts', {
    method: 'POST',
    token,
    json: {
      tenant_id: tenantId,
      unit_id: unitId,
      contract_start: new Date().toISOString().slice(0, 10),
      contract_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      notes: qa.contractNote
    }
  });
  if (!contract.response.ok) throw new Error(`Contract create failed: ${contract.response.status} ${JSON.stringify(contract.data)}`);
  contractId = contract.data.contract.id;
  result.steps.push({ step: 'contract_create', ok: true });

  const terminate = await request(`/contracts/${contractId}/terminate`, {
    method: 'PUT',
    token,
    json: { termination_reason: 'QA terminate' }
  });
  if (!terminate.response.ok) throw new Error(`Contract terminate failed: ${terminate.response.status}`);
  result.steps.push({ step: 'contract_terminate', ok: true });

  const payment = await request('/payments', {
    method: 'POST',
    token,
    json: {
      tenant_id: tenantId,
      unit_id: unitId,
      amount: 10000,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_period: '2026-12',
      payment_method: 'cash',
      notes: qa.paymentNote
    }
  });
  if (!payment.response.ok) throw new Error(`Payment create failed: ${payment.response.status} ${JSON.stringify(payment.data)}`);
  paymentId = payment.data.payment.id;
  result.steps.push({ step: 'payment_create', ok: true });

  const confirm = await request(`/payments/${paymentId}/confirm`, {
    method: 'PUT',
    token
  });
  if (!confirm.response.ok) throw new Error(`Payment confirm failed: ${confirm.response.status}`);
  result.steps.push({ step: 'payment_confirm', ok: true });

  const update = await request(`/payments/${paymentId}`, {
    method: 'PUT',
    token,
    json: {
      amount: 9000,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_period: '2026-12',
      payment_method: 'cash',
      notes: `${qa.paymentNote} updated`
    }
  });
  if (!update.response.ok) throw new Error(`Payment update failed: ${update.response.status}`);
  result.steps.push({ step: 'payment_update', ok: true });

  const remove = await request(`/payments/${paymentId}`, {
    method: 'DELETE',
    token
  });
  if (!remove.response.ok) throw new Error(`Payment delete failed: ${remove.response.status}`);
  paymentId = null;
  result.steps.push({ step: 'payment_delete', ok: true });
} catch (error) {
  result.findings.push(error.message);
} finally {
  if (token && tenantId) {
    await request(`/tenants/${tenantId}`, { method: 'DELETE', token }).catch(() => {});
  }
  if (token && unitId) {
    await request(`/units/${unitId}`, { method: 'DELETE', token }).catch(() => {});
  }
  if (token && buildingId) {
    await request(`/buildings/${buildingId}`, { method: 'DELETE', token }).catch(() => {});
  }
  console.log(JSON.stringify(result, null, 2));
}
