import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create transporter for sending emails
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD, // Use app-specific password for Gmail
    },
  });
};

// Function to send complaint resolution email
export const sendComplaintResolutionEmail = async ({
  recipientEmail,
  recipientName,
  complaintReason,
  orderDetails,
  managerAction,
  responseMessage,
  isRestaurant = false,
}) => {
  try {
    const transporter = createTransporter();

    const subject = `Complaint Resolution - ${
      isRestaurant ? "Restaurant" : "Customer"
    } Notification`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 8px;
        }
        .header {
          background-color: ${isRestaurant ? "#10b981" : "#f97316"};
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          padding: 20px;
          background-color: white;
          border-radius: 0 0 8px 8px;
        }
        .section {
          margin-bottom: 20px;
        }
        .section-title {
          font-weight: bold;
          color: ${isRestaurant ? "#10b981" : "#f97316"};
          margin-bottom: 10px;
          font-size: 16px;
        }
        .order-details {
          background-color: #f0f0f0;
          padding: 15px;
          border-radius: 5px;
          margin-top: 10px;
        }
        .action-badge {
          display: inline-block;
          padding: 5px 15px;
          border-radius: 20px;
          font-weight: bold;
          margin: 10px 0;
          ${
            managerAction === "Blocked"
              ? "background-color: #ef4444; color: white;"
              : managerAction === "Warned"
              ? "background-color: #f59e0b; color: white;"
              : "background-color: #10b981; color: white;"
          }
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Complaint Resolution Notice</h1>
        </div>
        <div class="content">
          <p>Dear ${recipientName},</p>
          
          <p>A complaint filed ${
            isRestaurant ? "against your restaurant" : "by you"
          } has been reviewed and resolved by our team.</p>
          
          <div class="section">
            <div class="section-title">📋 Complaint Reason:</div>
            <p>${complaintReason}</p>
          </div>
          
          <div class="section">
            <div class="section-title">📦 Order Details:</div>
            <div class="order-details">
              <p><strong>Order ID:</strong> ${orderDetails.orderId}</p>
              <p><strong>Total Amount:</strong> $${
                orderDetails.totalPrice?.toFixed(2) || "0.00"
              }</p>
              <p><strong>Payment Method:</strong> ${
                orderDetails.paymentMethod || "N/A"
              }</p>
              <p><strong>Delivery Address:</strong> ${
                orderDetails.deliveryAddress || "N/A"
              }</p>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">⚖️ Action Taken:</div>
            <span class="action-badge">${managerAction}</span>
            ${
              managerAction === "Blocked"
                ? `<p style="color: #ef4444; font-weight: bold;">Your ${
                    isRestaurant ? "restaurant" : "account"
                  } has been blocked. Please contact support for further assistance.</p>`
                : managerAction === "Warned"
                ? `<p style="color: #f59e0b; font-weight: bold;">You have received a warning. Please ensure compliance with our policies to avoid further action.</p>`
                : ""
            }
          </div>
          
          <div class="section">
            <div class="section-title">💬 Response from Management:</div>
            <p style="background-color: #f0f0f0; padding: 15px; border-left: 4px solid ${
              isRestaurant ? "#10b981" : "#f97316"
            }; border-radius: 5px;">
              ${responseMessage}
            </p>
          </div>
          
          <p>If you have any questions or concerns, please don't hesitate to contact our support team.</p>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>© ${new Date().getFullYear()} FoodGo. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    const mailOptions = {
      from: `"FoodGo Support" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

export default { sendComplaintResolutionEmail };
