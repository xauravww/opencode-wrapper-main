import nodemailer from 'nodemailer';
import parsedXlsx from 'xlsx';
import path from 'path';

// Configure transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

/**
 * Converts logs to Excel buffer
 * @param {Array} logs - Array of log objects
 * @returns {Buffer} - Excel file buffer
 */
const createExcelBuffer = (logs) => {
    const worksheet = parsedXlsx.utils.json_to_sheet(logs);
    const workbook = parsedXlsx.utils.book_new();
    parsedXlsx.utils.book_append_sheet(workbook, worksheet, "Logs");
    return parsedXlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * Sends backup email with Excel attachment
 * @param {string} to - Recipient email
 * @param {Array} logs - Array of request logs
 * @returns {Promise<void>}
 */
export const sendBackupEmail = async (to, logs) => {
    if (!to) {
        throw new Error("Recipient email (OWNER_MAIL) is not configured.");
    }
    if (!logs || logs.length === 0) {
        console.log("No logs to backup.");
        return;
    }

    const transporter = createTransporter();
    const excelBuffer = createExcelBuffer(logs);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `request_logs_backup_${dateStr}.xlsx`;

    const mailOptions = {
        from: `"Opencode Wrapper System" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: `[Backup] Request Logs - ${dateStr}`,
        text: `Attached is the backup of ${logs.length} request logs that are about to be deleted from the database.`,
        attachments: [
            {
                filename: filename,
                content: excelBuffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        ]
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Backup email sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("❌ Error sending backup email:", error);
        throw error; // Re-throw so caller knows it failed
    }
};
