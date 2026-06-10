const { z } = require('zod');

const optionalText = (max = 2000) => z.string().trim().max(max).optional().or(z.literal(''));
const requiredText = (field, max = 500) => z.string().trim().min(1, `${field} is required.`).max(max);
const numericText = z.union([z.string().trim(), z.number()]).optional().or(z.literal(''));
const booleanish = z.union([z.boolean(), z.string(), z.number()]).optional();

const emailSchema = z.string().trim().email('A valid email address is required.').max(255);

function isTruthy(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = String(value || '').trim().toLowerCase();
    return ['true', '1', 'on', 'yes'].includes(normalized);
}

function validatePropertyType(data, ctx) {
    if (data.type === 'Others' && !String(data.typeOther || '').trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Custom property type is required when type is Others.',
            path: ['typeOther']
        });
    }

    if (!isTruthy(data.isOwner)) {
        if (!String(data.owner_name || '').trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Owner name is required.',
                path: ['owner_name']
            });
        }

        if (!String(data.owner_mobile || '').trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Owner mobile number is required.',
                path: ['owner_mobile']
            });
        }

        if (!String(data.owner_email || '').trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Owner email address is required.',
                path: ['owner_email']
            });
        }
    }
}

const contactRequestSchema = z.object({
    requester_email: emailSchema.optional(),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const propertyReviewSchema = z.object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: optionalText(2000)
});

const propertySchemaShape = {
    title: requiredText('Property title', 255),
    locality: requiredText('Locality', 255),
    contact: optionalText(50),
    lat: numericText,
    lng: numericText,
    latitude: numericText,
    longitude: numericText,
    type: optionalText(100),
    typeOther: optionalText(100),
    listingType: z.enum(['rent', 'sale', 'lease', 'pg']).optional().or(z.literal('')),
    final_price: numericText,
    size: optionalText(100),
    condition: optionalText(5000),
    owner_name: optionalText(255),
    owner_mobile: optionalText(50),
    owner_email: emailSchema.optional().or(z.literal('')),
    isOwner: booleanish,
    ownership_declaration: booleanish,
    furnishing: optionalText(100),
    parking: optionalText(100),
    bathrooms: optionalText(50),
    facing: optionalText(100),
    configuration: optionalText(100),
    floor_number: optionalText(50),
    total_floors: optionalText(50),
    overlooking: optionalText(255),
    property_age: optionalText(100),
    negotiable: booleanish,
    pg_sharing: optionalText(100),
    pg_tenant: optionalText(100),
    pg_food: optionalText(100),
    pg_amenities: optionalText(500),
    owner_self_owned: booleanish,
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
};

const propertyAddSchema = z.object(propertySchemaShape).superRefine(validatePropertyType);

const propertyDeleteSchema = z.object({
    id: z.coerce.number().int().positive(),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const ownerPropertyEditSchema = z.object({
    ...propertySchemaShape,
    id: z.coerce.number().int().positive()
}).superRefine(validatePropertyType);

const chatStartSchema = z.object({
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
}).passthrough();

const chatMessageSchema = z.object({
    content: requiredText('Message', 5000),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const leadStatusValues = ['new', 'contacted', 'qualified', 'converted', 'closed', 'lost', 'pending', 'in_progress', 'completed'];

const visitStatusSchema = z.object({
    visitId: z.coerce.number().int().positive(),
    status: requiredText('Visit status', 50),
    notes: optionalText(2000),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const visitScheduleSchema = z.object({
    propertyId: z.coerce.number().int().positive(),
    preferredDate: optionalText(50),
    preferredTime: optionalText(50),
    contactNumber: optionalText(50),
    message: optionalText(2000),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const visitManageSchema = z.object({
    visit_id: z.coerce.number().int().positive(),
    action: z.enum(['approve', 'reject', 'reschedule', 'complete', 'cancel']),
    finalDate: optionalText(50),
    finalTime: optionalText(50),
    managerNotes: optionalText(2000),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const visitAssignSchema = z.object({
    visitId: z.coerce.number().int().positive(),
    agent_id: z.coerce.number().int().positive().optional().or(z.literal('')),
    agentId: z.coerce.number().int().positive().optional().or(z.literal('')),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const visitCreateAssignSchema = z.object({
    property_id: z.coerce.number().int().positive(),
    user_id: z.coerce.number().int().positive(),
    agent_id: z.coerce.number().int().positive().optional().or(z.literal('')),
    scheduled_at: optionalText(80),
    notes: optionalText(2000),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const leadCreateSchema = z.object({
    agent_id: z.coerce.number().int().positive().optional(),
    name: requiredText('Lead name', 255),
    phone: optionalText(50),
    email: emailSchema.optional().or(z.literal('')),
    type: optionalText(50),
    preferences: optionalText(4000),
    property_id: z.coerce.number().int().positive().optional().or(z.literal('')),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const leadStatusSchema = z.object({
    leadId: z.coerce.number().int().positive().optional(),
    lead_id: z.coerce.number().int().positive().optional(),
    status: z.enum(leadStatusValues).or(optionalText(50)),
    stage: optionalText(100),
    is_hot: booleanish,
    follow_up_date: optionalText(80),
    notes: optionalText(2000),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
}).superRefine((data, ctx) => {
    if (!data.leadId && !data.lead_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Lead ID is required.',
            path: ['leadId']
        });
    }
});

const leadDeleteSchema = z.object({
    id: z.coerce.number().int().positive(),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const leadReassignSchema = z.object({
    lead_id: z.coerce.number().int().positive(),
    new_agent_id: z.coerce.number().int().positive().optional().or(z.literal('')),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const builderLeadCreateSchema = z.object({
    project_id: z.coerce.number().int().positive().optional().or(z.literal('')),
    name: requiredText('Lead name', 255),
    phone: optionalText(50),
    email: emailSchema.optional().or(z.literal('')),
    source: optionalText(100),
    stage: optionalText(100),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

const builderLeadStatusSchema = z.object({
    lead_id: z.coerce.number().int().positive(),
    stage: optionalText(100),
    is_hot: booleanish,
    follow_up_date: optionalText(80),
    notes: optionalText(2000),
    _csrf: optionalText(128),
    csrfToken: optionalText(128)
});

module.exports = {
    contactRequestSchema,
    propertyReviewSchema,
    propertyAddSchema,
    propertyDeleteSchema,
    ownerPropertyEditSchema,
    chatStartSchema,
    chatMessageSchema,
    visitStatusSchema,
    visitScheduleSchema,
    visitManageSchema,
    visitAssignSchema,
    visitCreateAssignSchema,
    leadCreateSchema,
    leadStatusSchema,
    leadDeleteSchema,
    leadReassignSchema,
    builderLeadCreateSchema,
    builderLeadStatusSchema
};
