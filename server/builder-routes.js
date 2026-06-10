const express = require('express');
const router = express.Router();
const pool = require('./db');
const bcrypt = require('bcrypt');
const { validatePassword, addToPasswordHistory, generateUniqueUsername } = require('./utils');
const { emailQueue } = require('./email-queue');
const notificationService = require('./notification-service');
const { getUserPermissions, hasPermission } = require('./permission-utils');
const { salesAgentInsertFields } = require('./sales-agent-utils');
const { normalizeTaskStatus, normalizeTransactionStatus, isManagedSalesAgent } = require('./sales-workflow-utils');
const { authorize, loadAuthorizationSubject } = require('./services/authorization');
const validate = require('./validate');
const {
    builderLeadCreateSchema,
    builderLeadStatusSchema,
    visitAssignSchema
} = require('./validators/mutation-schemas');

const RESERVED_USERNAMES = new Set([
    'admin', 'support', 'login', 'logout', 'signup', 'register', 'auth',
    'search', 'property', 'properties', 'compare', 'requirements', 'favorites',
    'recently-viewed', 'my-chats', 'messages', 'visits', 'notifications',
    'profile', 'edit-profile', 'avatar-studio', 'wallet', 'vault', 'list-property',
    'owner', 'broker', 'builder', 'external-sales', 'corporate', 'dealer', 'agent',
    'contact', 'report', 'services', 'agents', 'about', 'privacy', 'terms', 'help',
    'team', 'blog', 'news', 'jobs', 'careers', 'press', 'media', 'status', 'docs',
    'api', 'assets', 'css', 'js', 'img', 'images', 'uploads', 'kyc-file', 'socket.io',
    'portfolio', 'root', 'info', 'test', 'testing', 'matrix', 'matrixspaces', 'saksh'
]);

const PROPERTY_OWNERSHIP_SELF = 'self_owned';
const ACTIVE_PROPERTY_STATUSES = new Set(['listed', 'reviewing', 'negotiating', 'verified']);

function isSelfOwnedProperty(property, userId) {
    const ownershipType = String(property && property.ownership_type || '').trim().toLowerCase();
    if (ownershipType === PROPERTY_OWNERSHIP_SELF) {
        return Number(property.owner_id) === Number(userId);
    }
    return !ownershipType && Number(property.owner_id) === Number(userId) && !property.assigned_broker_id;
}

function classifyDashboardProperties(properties, userId) {
    const myProperties = [];
    const managedProperties = [];

    for (const property of properties) {
        if (isSelfOwnedProperty(property, userId)) {
            myProperties.push(property);
        } else {
            managedProperties.push(property);
        }
    }

    return {
        myProperties,
        managedProperties,
        allProperties: properties
    };
}

function buildPropertyStatusCounts(properties) {
    const counts = {
        total: properties.length,
        active: 0,
        sold: 0,
        rented: 0,
        draft: 0
    };

    for (const property of properties) {
        const status = String(property.status || '').trim().toLowerCase();
        if (status === 'sold') counts.sold += 1;
        else if (status === 'rented') counts.rented += 1;
        else if (status === 'draft') counts.draft += 1;
        else if (ACTIVE_PROPERTY_STATUSES.has(status)) counts.active += 1;
    }

    return counts;
}

module.exports = function(upload, uploadKyc) {
// Middleware to ensure user is a builder for all routes in this file
router.use(async (req, res, next) => {
    const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
    if (!req.session.user) {
        return wantsJson ? res.status(401).json({ error: 'Unauthorized' }) : res.redirect('/login');
    }
    const permissions = await getUserPermissions(req.session.user.id);
    if (req.session.user.role !== 'builder' && !permissions.includes('view_builder_dashboard')) {
        return wantsJson ? res.status(403).json({ error: 'Forbidden' }) : res.status(403).send('Unauthorized');
    }
    next();
});

router.get('/', async (req, res) => {
    const permissions = await getUserPermissions(req.session.user.id);
    const can = (permission) => permissions.includes(permission);

    // Fetch Sales Agents under this builder
    const agents = can('manage_builder_agents') ? await pool.query(`
        SELECT *, COALESCE(permissions, '{}'::jsonb) as permissions FROM users 
        WHERE parent_id = $1 AND role = 'external_sales'
        ORDER BY username ASC
    `, [req.session.user.id]) : { rows: [] };
    
    // Fetch KYC Status
    const kyc = can('manage_builder_kyc') ? await pool.query('SELECT * FROM kyc_docs WHERE user_id = $1', [req.session.user.id]) : { rows: [] };

    // Fetch Visits made by Agents under this Builder
    let agentVisits = [];
    const agentIds = agents.rows.map(a => a.id);
    if (can('manage_builder_visits') && agentIds.length > 0) {
        const visitsRes = await pool.query(`
            SELECT v.*, p.title as property_title, p.locality, p.photos, u.username as renter_name, u.phone as renter_phone,
                   a.username as agent_name, parent.username as parent_name
            FROM visits v
            JOIN properties p ON v.property_id = p.id
            JOIN users u ON v.user_id = u.id
            LEFT JOIN users a ON v.agent_id = a.id
            LEFT JOIN users parent ON a.parent_id = parent.id
            WHERE v.agent_id = ANY($1::int[])
            ORDER BY v.scheduled_at DESC
        `, [agentIds]);
        agentVisits = visitsRes.rows;
    }
    
    // Fetch Unassigned Visits (for Builder to assign)
    const unassignedVisits = can('manage_builder_visits') ? await pool.query(`
        SELECT v.*, p.title as property_title, p.locality, p.photos, u.username as renter_name, u.phone as renter_phone,
               a.username as agent_name, parent.username as parent_name
        FROM visits v
        JOIN properties p ON v.property_id = p.id
        JOIN users u ON v.user_id = u.id
        LEFT JOIN users a ON v.agent_id = a.id
        LEFT JOIN users parent ON a.parent_id = parent.id
        WHERE v.agent_id IS NULL AND v.status != 'completed'
          AND (
                p.owner_id = $1
                OR p.assigned_broker_id = $1
                OR $1 = ANY(COALESCE(p.assigned_brokers, '{}'::int[]))
              )
        ORDER BY v.scheduled_at ASC
    `, [req.session.user.id]) : { rows: [] };

    // --- ERP LOGIC ---
    const projectsRes = can('manage_builder_projects') ? await pool.query(`
        SELECT p.*, 
               COALESCE(json_agg(json_build_object('id', u.id, 'username', u.username, 'email', u.email, 'phone', u.phone)) FILTER (WHERE u.id IS NOT NULL), '[]') as assigned_brokers
        FROM projects p
        LEFT JOIN project_brokers pb ON p.id = pb.project_id
        LEFT JOIN users u ON pb.broker_id = u.id
        WHERE p.builder_id = $1 
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `, [req.session.user.id]) : { rows: [] };
    
    // Fetch all available brokers for assignment
    const availableBrokers = can('manage_builder_projects') ? await pool.query("SELECT id, username, email, avatar_url FROM users WHERE role = 'broker' ORDER BY username ASC") : { rows: [] };

    const inventoryRes = can('manage_builder_inventory') ? await pool.query(`SELECT p.name as project_name, i.* FROM inventory_units i JOIN projects p ON i.project_id = p.id WHERE p.builder_id = $1`, [req.session.user.id]) : { rows: [] };
    const propertiesRes = can('manage_properties') ? await pool.query(`
        SELECT p.*, owner.username as owner_name, owner.phone as owner_phone, owner.email as owner_email
        FROM properties p
        LEFT JOIN users owner ON p.owner_id = owner.id
        WHERE p.owner_id = $1
           OR p.assigned_broker_id = $1
           OR $1 = ANY(COALESCE(p.assigned_brokers, '{}'::int[]))
        ORDER BY p.created_at DESC
    `, [req.session.user.id]) : { rows: [] };
    const builderPropertyGroups = classifyDashboardProperties(propertiesRes.rows, req.session.user.id);
    const builderMyPropertyCounts = buildPropertyStatusCounts(builderPropertyGroups.myProperties);
    const builderManagedPropertyCounts = buildPropertyStatusCounts(builderPropertyGroups.managedProperties);
    const leadsRes = can('manage_builder_leads') ? await pool.query(`SELECT bl.*, p.name as project_name FROM builder_leads bl LEFT JOIN projects p ON bl.project_id = p.id WHERE bl.builder_id = $1 ORDER BY bl.created_at DESC`, [req.session.user.id]) : { rows: [] };
    const portfolioRes = can('manage_builder_portfolio') ? await pool.query(`SELECT * FROM builder_portfolio WHERE builder_id = $1 ORDER BY completion_year DESC, created_at DESC`, [req.session.user.id]) : { rows: [] };

    const myLeads = can('manage_builder_leads') ? await pool.query('SELECT * FROM leads WHERE agent_id = $1 ORDER BY created_at DESC', [req.session.user.id]) : { rows: [] };
    const schedulesRes = can('manage_builder_leads') ? await pool.query(`
        SELECT s.*, l.name as lead_name, l.email as lead_email 
        FROM agent_schedules s 
        LEFT JOIN leads l ON s.reference_id = l.id 
        WHERE s.agent_id = $1 
        ORDER BY s.scheduled_at ASC
    `, [req.session.user.id]) : { rows: [] };

    const tasksRes = can('manage_builder_leads') ? await pool.query(`
        SELECT t.*, assignee.username as assignee_name, creator.username as creator_name, p.title as property_title, l.name as lead_name
        FROM agent_tasks t
        LEFT JOIN users assignee ON t.assigned_to = assignee.id
        LEFT JOIN users creator ON t.created_by = creator.id
        LEFT JOIN properties p ON t.related_property_id = p.id
        LEFT JOIN leads l ON t.related_lead_id = l.id
        WHERE t.assigned_to = $1 OR t.created_by = $1
        ORDER BY t.created_at DESC
    `, [req.session.user.id]) : { rows: [] };

    const transactionsRes = can('manage_builder_projects') ? await pool.query(`
        SELECT st.*, p.title as property_title
        FROM sales_transactions st
        LEFT JOIN properties p ON st.property_id = p.id
        WHERE st.agent_id = $1 OR st.agent_id IN (SELECT id FROM users WHERE parent_id = $1)
        ORDER BY st.created_at DESC
    `, [req.session.user.id]) : { rows: [] };

    const myReqsRes = can('manage_builder_requirements') ? await pool.query("SELECT * FROM corporate_requirements WHERE corporate_id = $1 ORDER BY created_at DESC", [req.session.user.id]) : { rows: [] };
    let mySuggRes = { rows: [] };
    try {
        if (can('manage_builder_requirements')) {
        mySuggRes = await pool.query(`
            SELECT rs.*, p.title as property_title, p.locality, p.final_price, p.type, p.photos, cr.cities as req_cities, cr.property_type as req_type
            FROM requirement_suggestions rs
            JOIN properties p ON rs.property_id = p.id
            JOIN corporate_requirements cr ON rs.requirement_id = cr.id
            WHERE cr.corporate_id = $1 AND rs.status = 'approved'
            ORDER BY rs.created_at DESC
        `, [req.session.user.id]);
        }
    } catch(e) {}

    const payload = { 
        user: req.session.user, 
        permissions,
        agents: agents.rows, 
        kyc: kyc.rows,
        agentVisits: agentVisits,
        unassignedVisits: unassignedVisits.rows,
        assignedProjects: projectsRes.rows,
        availableBrokers: availableBrokers.rows,
        myProperties: builderPropertyGroups.myProperties,
        managedProperties: builderPropertyGroups.managedProperties,
        allPropertiesList: builderPropertyGroups.allProperties,
        myPropertiesTotal: builderMyPropertyCounts.total,
        myPropertiesActive: builderMyPropertyCounts.active,
        myPropertiesSold: builderMyPropertyCounts.sold,
        myPropertiesRented: builderMyPropertyCounts.rented,
        myPropertiesDraft: builderMyPropertyCounts.draft,
        managedPropertiesCount: builderManagedPropertyCounts.total,
        inventory: inventoryRes.rows, 
        leads: leadsRes.rows,              // Existing builder CRM leads
        salesLeads: myLeads.rows,          // New external sales style leads
        schedules: schedulesRes.rows,
        salesTasks: tasksRes.rows,
        salesTransactions: transactionsRes.rows,
        portfolio: portfolioRes.rows,      // Builder Portfolio projects
        myRequirements: myReqsRes.rows,
        requirementSuggestions: mySuggRes.rows,
        error: req.query.error,
        message: req.query.message
    };

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json(payload);
    }

    res.render('builder-dashboard', payload);
});

router.post('/add-agent', hasPermission('manage_builder_agents'), async (req, res) => {
    const name = req.body.name || req.body.username;
    const { email, password, phone } = req.body;
    const passwordError = validatePassword(password);
    if (passwordError) return res.redirect('/builder?tab=salesManagement&error=' + encodeURIComponent(passwordError));
    const hash = await bcrypt.hash(password, 10);
    const targetRole = 'external_sales';
    const uniqueUsername = await generateUniqueUsername(name);

    if (RESERVED_USERNAMES.has(uniqueUsername.toLowerCase())) {
        return res.redirect('/builder?tab=salesManagement&error=' + encodeURIComponent('This username is reserved and cannot be used.'));
    }
    
    let nextAccountNumber;
    const resAcc = await pool.query("SELECT MAX(CAST(account_number AS INTEGER)) as max_acc FROM users WHERE role != 'admin' AND account_number ~ '^[0-9]{7}$'");
    nextAccountNumber = (resAcc.rows[0].max_acc || 1000000) + 1;

    try {
        const salesFields = salesAgentInsertFields(req.session.user.id, req.session.user.role);
        const result = await pool.query('INSERT INTO users (name, username, account_number, email, password_hash, role, phone, parent_id, sales_agent_type, parent_type, is_email_verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE) RETURNING id', 
            [name, uniqueUsername, nextAccountNumber.toString(), email, hash, targetRole, phone, req.session.user.id, salesFields.salesAgentType, salesFields.parentType]);
        await addToPasswordHistory(result.rows[0].id, hash);
        if (phone) {
            const waService = require('./whatsappService');
            const loginUrl = `http://${req.headers.host}/login`;
            waService.sendAccountCredentials(phone, name, uniqueUsername, email, password, loginUrl).catch(e => console.error("WA Error:", e));
        }
        await emailQueue.add('accountCredentialsEmail', { email, name, username: uniqueUsername, password, loginUrl });
        res.redirect('/builder?tab=salesManagement');
    } catch (err) { 
        console.error('Error creating agent:', err); res.redirect('/builder?tab=salesManagement&error=Failed+to+create+agent'); 
    }
});

router.post('/assign-visit', hasPermission('manage_builder_visits'), validate(visitAssignSchema), async (req, res) => {
    const { visitId, agentId } = req.body;
    const visit = await loadAuthorizationSubject('visit', visitId, req);
    const allowed = await authorize({
        user: req.session.user,
        resource: 'visit',
        action: 'assign',
        subject: visit,
        context: { agentId },
        req
    });
    if (!allowed) return res.status(403).send('Unauthorized');

    await pool.query('UPDATE visits SET agent_id = $1, status = CASE WHEN status = \'completed\' THEN status ELSE $2 END WHERE id = $3', [agentId || null, agentId ? 'assigned' : 'pending', visitId]);
    res.redirect('/builder');
});

router.post('/tasks/create', hasPermission('manage_builder_leads'), async (req, res) => {
    const { title, description, assigned_to, related_property_id, related_lead_id, due_at, notes } = req.body;
    const assigneeId = Number(assigned_to) || req.session.user.id;
    try {
        if (!await isManagedSalesAgent(req.session.user.id, assigneeId)) {
            return res.status(403).send('Unauthorized');
        }
        await pool.query(
            `INSERT INTO agent_tasks (title, description, created_by, assigned_to, parent_id, related_property_id, related_lead_id, due_at, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [title, description || null, req.session.user.id, assigneeId, req.session.user.id, related_property_id || null, related_lead_id || null, due_at || null, notes || null]
        );
        if (assigneeId !== req.session.user.id) {
            await notificationService.sendNotification(assigneeId, `New task assigned: ${title}`, '/builder');
        }
    } catch (err) {
        console.error('Task creation error:', err);
    }
    res.redirect('/builder?tab=salesManagement');
});

router.post('/tasks/update', hasPermission('manage_builder_leads'), async (req, res) => {
    const { task_id, status, notes } = req.body;
    const taskStatus = normalizeTaskStatus(status);
    try {
        const taskRes = await pool.query('SELECT id, assigned_to, created_by FROM agent_tasks WHERE id = $1', [task_id]);
        if (taskRes.rows.length === 0) return res.redirect('/builder?tab=salesManagement&error=Task+not+found');
        const task = taskRes.rows[0];
        const authorized = task.assigned_to === req.session.user.id || task.created_by === req.session.user.id || await isManagedSalesAgent(req.session.user.id, task.assigned_to);
        if (!authorized) return res.status(403).send('Unauthorized');

        await pool.query(
            `UPDATE agent_tasks
             SET status = $1,
                 notes = COALESCE($2, notes),
                 completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
             WHERE id = $3`,
            [taskStatus, notes || null, task_id]
        );
    } catch (err) {
        console.error('Task update error:', err);
    }
    res.redirect('/builder?tab=salesManagement');
});

router.post('/transactions/add', hasPermission('manage_builder_projects'), async (req, res) => {
    const { agent_id, property_id, counterparty_name, amount, stage, status, notes } = req.body;
    const targetAgentId = Number(agent_id) || req.session.user.id;
    try {
        if (!await isManagedSalesAgent(req.session.user.id, targetAgentId)) {
            return res.status(403).send('Unauthorized');
        }
        await pool.query(
            `INSERT INTO sales_transactions (agent_id, property_id, counterparty_name, amount, stage, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [targetAgentId, property_id || null, counterparty_name || null, amount || null, stage || 'initiated', normalizeTransactionStatus(status), notes || null]
        );
    } catch (err) {
        console.error('Transaction add error:', err);
    }
    res.redirect('/builder?tab=salesManagement');
});

// Add Project
router.post('/projects/add', hasPermission('manage_builder_projects'), (req, res, next) => {
    upload.array('photos', 10)(req, res, (err) => {
        if (err) return res.redirect('/builder?tab=myProjects&error=' + encodeURIComponent(err.message));
        next();
    });
}, async (req, res) => {
    const { name, type, location, description, status, rera_id } = req.body;
    const photoFiles = req.files ? req.files.map(f => f.location || f.key || f.filename) : [];
    await pool.query('INSERT INTO projects (builder_id, name, type, location, description, status, rera_id, photos) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
        [req.session.user.id, name, type, location, description, status || 'Upcoming', rera_id, photoFiles]);
    res.redirect('/builder?tab=myProjects&message=Project+launched+successfully');
});

// Assign Brokers to Project
router.post('/projects/assign-brokers', hasPermission('manage_builder_projects'), async (req, res) => {
    const { project_id, broker_ids } = req.body;
    try {
        await pool.query('DELETE FROM project_brokers WHERE project_id = $1', [project_id]);
        if (broker_ids) {
            const ids = Array.isArray(broker_ids) ? broker_ids : [broker_ids];
            for (let bId of ids) {
                await pool.query('INSERT INTO project_brokers (project_id, broker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [project_id, bId]);
            }
        }
        res.redirect('/builder?tab=projects&message=Brokers+assigned+successfully');
    } catch (err) {
        res.redirect('/builder?tab=projects&error=Failed+to+assign+brokers');
    }
});

// Add Single Inventory Unit
router.post('/inventory/add', hasPermission('manage_builder_inventory'), async (req, res) => {
    const { project_id, tower, floor, unit_number, area, type, price, visibility } = req.body;
    const proj = await pool.query('SELECT id FROM projects WHERE id = $1 AND builder_id = $2', [project_id, req.session.user.id]);
    if (proj.rows.length === 0) return res.status(403).send('Invalid project');
    await pool.query('INSERT INTO inventory_units (project_id, tower, floor, unit_number, area, type, price, visibility) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [project_id, tower, floor, unit_number, area, type, price, visibility || 'Public']);
    res.redirect('/builder?tab=inventory');
});

// Update Inventory Status
router.post('/inventory/update-status', hasPermission('manage_builder_inventory'), async (req, res) => {
    const { unit_id, status } = req.body;
    await pool.query(`
        UPDATE inventory_units 
        SET status = $1 
        WHERE id = $2 AND project_id IN (SELECT id FROM projects WHERE builder_id = $3)
    `, [status, unit_id, req.session.user.id]);
    res.redirect('/builder?tab=inventory');
});

// Add Lead
router.post('/leads/add', hasPermission('manage_builder_leads'), validate(builderLeadCreateSchema), async (req, res) => {
    const { project_id, name, phone, email, source, stage } = req.body;
    await pool.query('INSERT INTO builder_leads (builder_id, project_id, name, phone, email, source, stage) VALUES ($1, $2, $3, $4, $5, $6, $7)', [req.session.user.id, project_id || null, name, phone, email, source || 'Direct', stage || 'Inquiry']);
    res.redirect('/builder?tab=salesManagement');
});

// Update CRM Lead Status (Hot Leads & Follow-ups)
router.post('/leads/update-status', hasPermission('manage_builder_leads'), validate(builderLeadStatusSchema), async (req, res) => {
    const { lead_id, stage, is_hot, follow_up_date, notes } = req.body;
    await pool.query(`
        UPDATE builder_leads 
        SET stage = $1, is_hot = $2, follow_up_date = $3, notes = $4 
        WHERE id = $5 AND builder_id = $6
    `, [stage, is_hot === 'on' || is_hot === 'true', follow_up_date || null, notes, lead_id, req.session.user.id]);
    res.redirect('/builder?tab=salesManagement');
});

// Add Portfolio Project
router.post('/portfolio/add', hasPermission('manage_builder_portfolio'), (req, res, next) => {
    upload.array('photos', 10)(req, res, (err) => {
        if (err) return res.redirect('/builder?tab=myProjects&error=' + encodeURIComponent(err.message));
        next();
    });
}, async (req, res) => {
    const { name, type, location, completion_year, amenities, description } = req.body;
    const photoFiles = req.files ? req.files.map(f => f.location || f.key || f.filename) : [];
    await pool.query('INSERT INTO builder_portfolio (builder_id, name, type, location, completion_year, amenities, description, photos) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
        [req.session.user.id, name, type, location, completion_year, amenities, description, JSON.stringify(photoFiles)]);
    res.redirect('/builder?tab=myProjects&message=Portfolio+project+added');
});

// Upload KYC Document
router.post('/kyc/upload', hasPermission('manage_builder_kyc'), (req, res, next) => {
    const uploader = uploadKyc ? uploadKyc.single('document') : upload.single('document');
    uploader(req, res, (err) => {
        if (err) return res.redirect('/builder?error=' + encodeURIComponent(err.message));
        next();
    });
}, async (req, res) => {
    const { doc_type, document_number } = req.body;
    if (req.file) {
        const filePath = req.file.key || req.file.filename;
        await pool.query('INSERT INTO kyc_docs (user_id, doc_type, document_number, file_path, status) VALUES ($1, $2, $3, $4, $5)', 
            [req.session.user.id, doc_type, document_number, filePath, 'pending']);
    }
    res.redirect('/builder?message=Document+uploaded+successfully');
});

    return router;
};
