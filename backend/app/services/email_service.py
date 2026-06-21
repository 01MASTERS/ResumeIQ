import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

def send_invitation_email(recipient_email: str, subject: str, message_body: str) -> bool:
    """
    Sends an email using the configured SMTP server.
    """
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.error("SMTP credentials are not configured in the environment.")
        return False
        
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USERNAME
        msg['To'] = recipient_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(message_body, 'plain'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {str(e)}")
        return False
