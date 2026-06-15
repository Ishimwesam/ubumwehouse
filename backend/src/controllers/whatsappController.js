const whatsappMessagingService = require('../services/whatsappMessagingService');

const getDashboard = async (req, res) => {
  try {
    const [summary, templates, tenants, history] = await Promise.all([
      whatsappMessagingService.getSummary(),
      whatsappMessagingService.getTemplates(),
      whatsappMessagingService.getTenantMessagingList(),
      whatsappMessagingService.getHistory({ limit: 60 })
    ]);

    return res.json({ summary, templates, tenants, history });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load WhatsApp dashboard', details: error.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const history = await whatsappMessagingService.getHistory({
      tenantId: req.query.tenant_id || '',
      limit: req.query.limit || 80
    });
    return res.json({ history });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load WhatsApp history', details: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { tenant_id, tenant_ids, template_id, message_type, message_body, variables } = req.body || {};
    const sentBy = req.user?.id || null;

    if (Array.isArray(tenant_ids) && tenant_ids.length > 0) {
      const result = await whatsappMessagingService.sendBulkMessage({
        tenantIds: tenant_ids,
        templateId: template_id,
        messageType: message_type || 'manual',
        messageBody: message_body || '',
        variables: variables || {},
        sentBy
      });
      return res.json({ message: 'Bulk WhatsApp send completed', ...result });
    }

    if (!tenant_id) {
      return res.status(400).json({ error: 'Choose at least one tenant before sending.' });
    }

    const result = await whatsappMessagingService.sendTenantMessage({
      tenantId: tenant_id,
      templateId: template_id,
      messageType: message_type || 'manual',
      messageBody: message_body || '',
      variables: variables || {},
      sentBy
    });
    return res.json({ message: 'WhatsApp send completed', ...result });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to send WhatsApp message' });
  }
};

const sendOpenBalanceReminders = async (req, res) => {
  try {
    const result = await whatsappMessagingService.sendOpenBalanceReminders({
      sentBy: req.user?.id || null,
      overdueOnly: Boolean(req.body?.overdue_only)
    });
    return res.json({ message: 'WhatsApp rent reminders completed', ...result });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to send WhatsApp reminders', details: error.message });
  }
};

module.exports = {
  getDashboard,
  getHistory,
  sendMessage,
  sendOpenBalanceReminders
};
