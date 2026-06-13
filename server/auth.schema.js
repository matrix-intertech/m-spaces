const { z } = require('zod');
const { isDisposableEmail } = require('./utils');

const loginSchema = z.object({
    email: z.string().optional(),
    username: z.string().optional(),
    password: z.string().min(1, { message: "Password is required." }),
    remember: z.any().optional(), // 'remember' can be 'on' or undefined
    redirect: z.string().optional(),
}).superRefine((data, ctx) => {
    const identifier = data.email || data.username;
    if (!identifier || identifier.trim() === '') {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Email, Username, or Account Number is required.",
            path: ['email'],
        });
    } else if (identifier.includes('@') && isDisposableEmail(identifier)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Disposable email addresses are not allowed.",
            path: ['email'],
        });
    }
});

// Phone number validation now allows an optional '+' for international numbers
const sendWhatsappOtpSchema = z.object({
    phone: z.string()
        .min(7, { message: "A valid phone number is required." })
        .max(20)
        .regex(/^\+?\d+$/, { message: "Phone number must contain only digits and an optional '+' sign." }),
    referral_code: z.string().optional(),
});

const signupAvailabilitySchema = z.object({
    phone: z.string()
        .trim()
        .max(20, { message: "Phone number must be 20 characters or fewer." })
        .regex(/^\+?\d*$/, { message: "Phone number must contain only digits and an optional '+' sign." })
        .optional()
        .or(z.literal('')),
    username: z.string().trim().max(255).optional().or(z.literal('')),
    excludeUserId: z.union([z.number().int(), z.string().trim()]).optional()
}).superRefine((data, ctx) => {
    if (!data.phone && !data.username) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Phone number or username is required.",
            path: ['phone']
        });
    }
});

// New schema for standard signup (Broker, Sales Agent, Owner, Tenant)
const signupSchema = z.object({
    name: z.string().min(1, { message: "Full Name is required." }),
    email: z.string()
        .email({ message: "A valid email address is required." })
        .refine(email => !isDisposableEmail(email), { message: "Disposable email addresses are not allowed." }),
    password: z.string().min(8, { message: "Password must be at least 8 characters long." }), // Basic length check, more detailed validation in utils.js
    phone: z.string().min(7, { message: "A valid phone number is required." }).max(20).regex(/^\+?\d+$/, { message: "Phone number must contain only digits and an optional '+' sign." }).optional().or(z.literal('')),
    role: z.enum(['tenant', 'owner', 'external_sales', 'broker', 'builder'], { message: "Invalid role selected." }),
    agency_name: z.string().optional().or(z.literal('')),
    corporate_type: z.string().optional().or(z.literal('')), // Added for corporate signup
    gst_number: z.string().optional().or(z.literal('')),
    rera_number: z.string().optional().or(z.literal('')),
    terms: z.literal('on', { message: "You must agree to the Terms of Service." }),
    referral_code: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
    if (['broker', 'builder'].includes(data.role) && (!data.agency_name || data.agency_name.trim() === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Company / Agency Name is required for this role.",
            path: ['agency_name'],
        });
    }
    // Corporate type is required if role is corporate
    if (data.role === 'corporate' && (!data.corporate_type || data.corporate_type.trim() === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Corporate Type is required for this role.",
            path: ['corporate_type'],
        });
    }
});

// Schema for Builder signup, extending the base signup schema
const builderSignupSchema = signupSchema.extend({
    // KYC documents are handled by Multer, so they are optional in Zod
    aadhaar: z.any().optional(),
    pan: z.any().optional(),
    license: z.any().optional(),
    passport: z.any().optional(),
});

const profileCompletionSchema = z.object({
    name: z.string().min(1, { message: "Full Name is required." }),
    email: z.string()
        .email({ message: "A valid email address is required." })
        .refine(email => !isDisposableEmail(email), { message: "Disposable email addresses are not allowed." }),
    agency_name: z.string().optional().or(z.literal('')),
    gst_number: z.string().optional().or(z.literal('')),
    rera_number: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
    // This validation will be applied dynamically based on the user's role during profile completion
    // The backend route will handle the role-specific requirements.
    // For now, ensure agency_name is present if it's a business role.
    // The actual role check will happen in the route.
    if (data.agency_name && data.agency_name.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Company Name cannot be empty if provided.", path: ['agency_name'] });
    }
});


module.exports = { loginSchema, sendWhatsappOtpSchema, signupAvailabilitySchema, signupSchema, builderSignupSchema, profileCompletionSchema };
