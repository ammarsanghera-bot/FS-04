import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage) {
    console.info("\n[email:mock]");
    console.info(`To: ${message.to}`);
    console.info(`Subject: ${message.subject}`);
    console.info(message.text);
    console.info("[/email:mock]\n");
  }
}

class SmtpEmailSender implements EmailSender {
  private transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
  });

  async send(message: EmailMessage) {
    await this.transport.sendMail({
      from: env.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

export const emailSender: EmailSender = env.SMTP_HOST ? new SmtpEmailSender() : new ConsoleEmailSender();

export async function sendEmail(message: EmailMessage) {
  await emailSender.send(message);
}
