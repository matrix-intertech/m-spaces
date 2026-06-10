const nodemailer = require('nodemailer');

// --- Pre-flight check for common .env errors ---
if (process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes('@')) {
    console.error('❌ FATAL: .env configuration error.');
    console.error(`Your EMAIL_HOST is set to "${process.env.EMAIL_HOST}", which looks like an email address.`);
    console.error('It should be a server hostname, like "smtp.gmail.com". Please correct your .env file.');
    process.exit(1); // Exit immediately to prevent further errors
}
// ------------------------------------------------

// Configure the email transporter
// Ensure EMAIL_USER and EMAIL_PASS are set in your .env file
const transporter = nodemailer.createTransport({
  // Use environment variables if available, otherwise fallback to gmail
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
  service: process.env.EMAIL_HOST ? null : 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use an App Password for Gmail, not your login password
  },
});

/**
 * Sends an OTP to the specified email address.
 * @param {string} email - The recipient's email address.
 * @param {string} otp - The One-Time Password to send.
 */
const sendOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: `"MarixSpaces Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h3>Verification Required</h3>
        <p>Your OTP code is: <b style="font-size: 24px; color: #4CAF50;">${otp}</b></p>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends a notification email when a property is added to favorites.
 * @param {string} email - The recipient's email address.
 * @param {string} propertyTitle - The title of the property.
 */
const sendFavoriteNotificationEmail = async (email, propertyTitle) => {
  const mailOptions = {
    from: `"MarixSpaces" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Property added to your favorites!`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h3>You have a new favorite!</h3>
        <p>You've added the property "<b>${propertyTitle}</b>" to your favorites.</p>
        <p>You can view your favorites here: <a href="http://localhost:3000/favorites">View Favorites</a></p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends a visit confirmation email.
 * @param {string} email - The recipient's email address.
 * @param {string} userType - 'owner' or 'renter'.
 * @param {object} visitDetails - An object containing visit details.
 * @param {string} visitDetails.propertyTitle - The title of the property.
 * @param {string} visitDetails.scheduledAt - The scheduled time of the visit.
 * @param {number} visitDetails.latitude - The latitude of the property.
 * @param {number} visitDetails.longitude - The longitude of the property.
 */
const sendVisitConfirmationEmail = async (email, userType, visitDetails) => {
  const { propertyTitle, scheduledAt, latitude, longitude } = visitDetails;
  const formattedDate = new Date(scheduledAt).toLocaleString();
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasValidDirections = Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
  const directionsUrl = hasValidDirections ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null;

  const mailOptions = {
    from: `"MarixSpaces" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Visit Scheduled for ${propertyTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h3>Visit Confirmation</h3>
        <p>Hello,</p>
        <p>A visit has been scheduled for the property "<b>${propertyTitle}</b>".</p>
        <p><b>Time:</b> ${formattedDate}</p>
        ${userType === 'renter' ? `<p>Please be on time.</p>` : ''}
        ${directionsUrl ? `<a href="${directionsUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">Get Directions</a>` : `<p>Directions will be shared once the property location is verified.</p>`}
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends a templated email from an agent.
 * @param {string} email - The recipient's email address.
 * @param {string} templateType - The type of template to use.
 * @param {object} data - Data to populate the template.
 */
const sendAgentTemplateEmail = async (email, templateType, data) => {
  let subject = '';
  let html = '';
  
  switch(templateType) {
      case 'visit_reminder':
          subject = `Reminder: Visit to ${data.propertyTitle}`;
          html = `<p>Hi ${data.name},</p><p>This is a reminder for your scheduled visit to <b>${data.propertyTitle}</b> on <b>${new Date(data.visitTime).toLocaleString()}</b>.</p><p>Best regards,<br>${data.agentName}<br>MatrixSpaces Sales Team</p>`;
          break;
      case 'visit_confirmation_owner':
          subject = `Visit Scheduled: ${data.propertyTitle}`;
          html = `<p>Hi ${data.name},</p><p>A visit has been scheduled for your property <b>${data.propertyTitle}</b> on <b>${new Date(data.visitTime).toLocaleString()}</b>.</p><p>Best regards,<br>${data.agentName}<br>MatrixSpaces Sales Team</p>`;
          break;
      case 'follow_up':
          subject = `Follow up: ${data.propertyTitle}`;
          html = `<p>Hi ${data.name},</p><p>How was your visit to <b>${data.propertyTitle}</b>? We would love to hear your feedback and discuss next steps.</p><p>Best regards,<br>${data.agentName}<br>MatrixSpaces Sales Team</p>`;
          break;
      case 'lead_intro':
          subject = `Opportunities at MatrixSpaces`;
          html = `<p>Hi ${data.name},</p><p>I am ${data.agentName} from MatrixSpaces. I have some property opportunities that might match your preferences.</p><p>Please let me know when we can connect to discuss further.</p><p>Best regards,<br>${data.agentName}</p>`;
          break;
  }

  const mailOptions = {
      from: `"MatrixSpaces Agent" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">${html}</div>`
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends a status update email to the property owner.
 * @param {string} email - The recipient's email address.
 * @param {string} propertyTitle - The title of the property.
 * @param {string} status - The new status.
 */
const sendStatusUpdateEmail = async (email, propertyTitle, status) => {
  const mailOptions = {
    from: `"MatrixSpaces" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Update: ${propertyTitle}`,
    text: `Property status updated to: ${status}.`
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends a visit request approval email to the owner.
 */
const sendVisitRequestEmail = async (email, ownerName, renterName, propertyTitle, preferredTime, approveLink) => {
  const mailOptions = {
    from: `"MatrixSpaces" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `New Visit Request for ${propertyTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h3>New Visit Request</h3>
        <p>Hello ${ownerName},</p>
        <p><b>${renterName}</b> has requested to visit your property "<b>${propertyTitle}</b>".</p>
        <p>Please click the button below to approve the visit and set the scheduled time.</p>
        <a href="${approveLink}" style="background-color: #DC143C; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; margin-top: 10px; font-weight: bold;">Approve Visit</a>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends an update on a wishlisted property.
 * @param {string} email - The recipient's email address.
 * @param {string} username - The recipient's username.
 * @param {string} propertyTitle - The title of the property.
 * @param {string} status - The new status.
 * @param {number} propertyId - The property ID.
 * @param {string} host - The host URL for the link.
 */
const sendWishlistUpdateEmail = async (email, username, propertyTitle, status, propertyId, host) => {
  const mailOptions = {
    from: `"MatrixSpaces" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Update on wishlisted property: ${propertyTitle}`,
    text: `Hello ${username},\n\nThe property "${propertyTitle}" you have in your wishlist has been updated.\n\nNew Status: ${status}\n\nView here: http://${host}/property/${propertyId}`
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends a visit rejection email to the renter.
 * @param {string} email - The recipient's email address.
 * @param {string} renterName - The name of the renter.
 * @param {string} propertyTitle - The title of the property.
 */
const sendVisitRejectionEmail = async (email, renterName, propertyTitle) => {
  const mailOptions = {
    from: `"MatrixSpaces" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Update on your visit request for ${propertyTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h3>Visit Request Update</h3>
        <p>Hello ${renterName},</p>
        <p>We regret to inform you that your visit request for the property "<b>${propertyTitle}</b>" has been rejected by the property manager.</p>
        <p>You can browse for other similar properties here: <a href="http://${process.env.HOST || 'localhost:3000'}/search">Search Properties</a></p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends an email notification when a visit is assigned to an agent.
 * @param {string} email - The recipient's email address.
 * @param {object} visitDetails - An object containing visit details.
 */
const sendContactUpdatedVisitEmail = async (email, visitDetails) => {
  const { userName, date, time, agentName, agentPhone, mapUrl } = visitDetails;
  const mailOptions = {
    from: `"MatrixSpaces" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your upcoming visit has been assigned a contact person`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h3>Visit Contact Updated</h3>
        <p>Hello ${userName},</p>
        <p>For your upcoming visit on <b>${date} at ${time}</b>, your point of contact will be <b>${agentName}</b>.</p>
        <p>You can reach them at: <b>${agentPhone}</b>.</p>
        <p>You can find directions to the property here: <a href="${mapUrl}">Get Directions</a></p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends account credentials via email.
 * @param {string} email - The recipient's email address.
 * @param {string} name - The user's name.
 * @param {string} username - The user's username.
 * @param {string} password - The user's password.
 * @param {string} loginUrl - The URL to the login page.
 */
const sendAccountCredentialsEmail = async (email, name, username, password, loginUrl) => {
  const mailOptions = {
    from: `"MatrixSpaces" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your New MatrixSpaces Account Credentials',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h3>Welcome to MatrixSpaces!</h3>
        <p>Hello ${name},</p>
        <p>An account has been created for you. You can log in using the following credentials:</p>
        <ul>
          <li><strong>Username:</strong> ${username}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Password:</strong> ${password}</li>
        </ul>
        <p>Please log in here: <a href="${loginUrl}">${loginUrl}</a></p>
        <p>We recommend changing your password after your first login.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail, sendFavoriteNotificationEmail, sendVisitConfirmationEmail, sendAgentTemplateEmail, sendStatusUpdateEmail, sendWishlistUpdateEmail, sendVisitRequestEmail, sendVisitRejectionEmail, sendContactUpdatedVisitEmail, sendAccountCredentialsEmail };
