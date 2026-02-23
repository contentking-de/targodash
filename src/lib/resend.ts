import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM || "SEO Dashboard <system@smedash.com>";

export async function sendMagicLinkEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: "Dein Magic Link zum Einloggen",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">SEO Dashboard</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Klicke auf den Button unten, um Dich einzuloggen. Dieser Link ist 24 Stunden gültig.
            </p>
            <a href="${url}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Jetzt einloggen
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              Falls Du diesen Link nicht angefordert hast, kannst Du diese E-Mail ignorieren.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send magic link email:", error);
    throw error;
  }

  return data;
}

export async function sendNewBriefingNotification({
  to,
  briefingTitle,
  briefingNumber,
  requesterName,
  dashboardUrl,
}: {
  to: string;
  briefingTitle: string;
  briefingNumber: number;
  requesterName: string;
  dashboardUrl: string;
}) {
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: `Neue Briefing-Bestellung: ${briefingTitle} (#${briefingNumber})`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">Neue Briefing-Bestellung</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Ein neues Briefing wurde von <strong>${requesterName}</strong> bestellt.
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;"><strong>Briefing-Nr.:</strong> #${briefingNumber}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0;"><strong>Titel:</strong> ${briefingTitle}</p>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Briefing ansehen
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              Diese E-Mail wurde automatisch vom SEO Dashboard versendet.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send briefing notification email:", error);
    throw error;
  }

  return data;
}

export async function sendTaskAssignmentNotification({
  to,
  taskTitle,
  taskDescription,
  creatorName,
  priority,
  dueDate,
  dashboardUrl,
}: {
  to: string;
  taskTitle: string;
  taskDescription: string | null;
  creatorName: string;
  priority: string;
  dueDate: string | null;
  dashboardUrl: string;
}) {
  const priorityLabels: Record<string, string> = {
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    urgent: "Dringend",
  };
  
  const priorityColors: Record<string, string> = {
    low: "#64748b",
    medium: "#3b82f6",
    high: "#f97316",
    urgent: "#ef4444",
  };

  const priorityLabel = priorityLabels[priority] || priority;
  const priorityColor = priorityColors[priority] || "#3b82f6";

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: `Neuer Task zugewiesen: ${taskTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">Neuer Task zugewiesen</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Dir wurde ein neuer Task von <strong>${creatorName}</strong> zugewiesen.
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #18181b; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${taskTitle}</p>
              ${taskDescription ? `<p style="color: #52525b; font-size: 14px; margin: 0 0 12px 0;">${taskDescription}</p>` : ""}
              <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <span style="display: inline-block; padding: 4px 8px; background-color: ${priorityColor}20; color: ${priorityColor}; font-size: 12px; border-radius: 4px; font-weight: 500;">
                  Priorität: ${priorityLabel}
                </span>
                ${dueDate ? `<span style="display: inline-block; padding: 4px 8px; background-color: #e2e8f0; color: #475569; font-size: 12px; border-radius: 4px;">Fällig: ${new Date(dueDate).toLocaleDateString("de-DE")}</span>` : ""}
              </div>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Task ansehen
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              Diese E-Mail wurde automatisch vom SEO Dashboard versendet.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send task assignment notification email:", error);
    throw error;
  }

  return data;
}

export async function sendTaskCommentNotification({
  to,
  taskTitle,
  commentText,
  authorName,
  dashboardUrl,
}: {
  to: string;
  taskTitle: string;
  commentText: string;
  authorName: string;
  dashboardUrl: string;
}) {
  // Kommentar kürzen wenn zu lang
  const truncatedComment = commentText.length > 300 
    ? commentText.substring(0, 300) + "..." 
    : commentText;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: `Neuer Kommentar: ${taskTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">Neuer Kommentar</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              <strong>${authorName}</strong> hat einen Kommentar zum Task <strong>${taskTitle}</strong> hinzugefügt:
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
              <p style="color: #52525b; font-size: 14px; margin: 0; white-space: pre-wrap;">${truncatedComment}</p>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Task ansehen
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              Diese E-Mail wurde automatisch vom SEO Dashboard versendet.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send task comment notification email:", error);
    throw error;
  }

  return data;
}

export async function sendBriefingCompletedNotification({
  to,
  briefingTitle,
  briefingNumber,
  dashboardUrl,
}: {
  to: string;
  briefingTitle: string;
  briefingNumber: number;
  dashboardUrl: string;
}) {
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: `Briefing fertiggestellt: ${briefingTitle} (#${briefingNumber})`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background-color: #10b981; border-radius: 50%; padding: 12px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0; text-align: center;">Briefing fertiggestellt!</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
              Dein Briefing wurde fertiggestellt und steht zum Download bereit.
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;"><strong>Briefing-Nr.:</strong> #${briefingNumber}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0;"><strong>Titel:</strong> ${briefingTitle}</p>
            </div>
            <p style="color: #52525b; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
              Du kannst das Briefing jetzt als PDF herunterladen oder direkt im Dashboard ansehen.
            </p>
            <div style="text-align: center;">
              <a href="${dashboardUrl}" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Briefing ansehen & PDF downloaden
              </a>
            </div>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
              Diese E-Mail wurde automatisch vom SEO Dashboard versendet.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send briefing completed notification email:", error);
    throw error;
  }

  return data;
}

// ===== Ticket Notifications =====

export async function sendTicketAssignmentNotification({
  to,
  ticketTitle,
  ticketType,
  priority,
  creatorName,
  dashboardUrl,
}: {
  to: string;
  ticketTitle: string;
  ticketType: string;
  priority: string;
  creatorName: string;
  dashboardUrl: string;
}) {
  const typeLabels: Record<string, string> = {
    bug: "Bug",
    feature: "Feature-Wunsch",
  };

  const priorityLabels: Record<string, string> = {
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
  };

  const priorityColors: Record<string, string> = {
    low: "#64748b",
    medium: "#3b82f6",
    high: "#ef4444",
  };

  const typeLabel = typeLabels[ticketType] || ticketType;
  const priorityLabel = priorityLabels[priority] || priority;
  const priorityColor = priorityColors[priority] || "#3b82f6";

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: `Ticket zugewiesen: ${ticketTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">Ticket zugewiesen</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Dir wurde ein Ticket von <strong>${creatorName}</strong> zugewiesen.
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #18181b; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${ticketTitle}</p>
              <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <span style="display: inline-block; padding: 4px 8px; background-color: #e2e8f0; color: #475569; font-size: 12px; border-radius: 4px;">
                  Typ: ${typeLabel}
                </span>
                <span style="display: inline-block; padding: 4px 8px; background-color: ${priorityColor}20; color: ${priorityColor}; font-size: 12px; border-radius: 4px; font-weight: 500;">
                  Priorität: ${priorityLabel}
                </span>
              </div>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Ticket ansehen
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              Diese E-Mail wurde automatisch vom SEO Dashboard versendet.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send ticket assignment notification email:", error);
    throw error;
  }

  return data;
}

export async function sendTicketUpdateNotification({
  to,
  ticketTitle,
  updateType,
  updateDetails,
  updaterName,
  dashboardUrl,
}: {
  to: string;
  ticketTitle: string;
  updateType: string; // "status", "comment", "assignee", "general"
  updateDetails: string;
  updaterName: string;
  dashboardUrl: string;
}) {
  const updateTypeLabels: Record<string, string> = {
    status: "Status geändert",
    comment: "Neuer Kommentar",
    assignee: "Zuweisung geändert",
    general: "Ticket aktualisiert",
  };

  const subjectPrefix = updateTypeLabels[updateType] || "Ticket aktualisiert";

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: `${subjectPrefix}: ${ticketTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">${subjectPrefix}</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              <strong>${updaterName}</strong> hat das Ticket <strong>${ticketTitle}</strong> aktualisiert.
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
              <p style="color: #52525b; font-size: 14px; margin: 0; white-space: pre-wrap;">${updateDetails}</p>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Ticket ansehen
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              Diese E-Mail wurde automatisch vom SEO Dashboard versendet.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send ticket update notification email:", error);
    throw error;
  }

  return data;
}

// ===== Editorial Plan Notifications =====

export async function sendEditorialPlanStatusNotification({
  to,
  entryTitle,
  oldStatus,
  newStatus,
  updaterName,
  dueDate,
  dashboardUrl,
}: {
  to: string;
  entryTitle: string;
  oldStatus: string | null;
  newStatus: string;
  updaterName: string;
  dueDate: string | null;
  dashboardUrl: string;
}) {
  const isNew = !oldStatus;
  const subject = isNew
    ? `Redaktionsplan: Neuer Eintrag zugewiesen – ${entryTitle}`
    : `Redaktionsplan: Status geändert – ${entryTitle}`;

  const statusInfo = isNew
    ? `<p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Dir wurde ein neuer Eintrag im Redaktionsplan von <strong>${updaterName}</strong> zugewiesen.
      </p>`
    : `<p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        <strong>${updaterName}</strong> hat den Status eines Eintrags im Redaktionsplan geändert.
      </p>`;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">Redaktionsplan</h1>
            ${statusInfo}
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #18181b; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">${entryTitle}</p>
              <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                ${!isNew ? `
                  <span style="display: inline-block; padding: 4px 8px; background-color: #fee2e2; color: #991b1b; font-size: 12px; border-radius: 4px; text-decoration: line-through;">
                    ${oldStatus}
                  </span>
                  <span style="display: inline-block; font-size: 12px; color: #94a3b8;">→</span>
                ` : ""}
                <span style="display: inline-block; padding: 4px 8px; background-color: #dcfce7; color: #166534; font-size: 12px; border-radius: 4px; font-weight: 500;">
                  ${newStatus}
                </span>
                ${dueDate ? `<span style="display: inline-block; padding: 4px 8px; background-color: #e2e8f0; color: #475569; font-size: 12px; border-radius: 4px;">Fällig: ${new Date(dueDate).toLocaleDateString("de-DE")}</span>` : ""}
              </div>
            </div>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Redaktionsplan öffnen
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0;">
              Diese E-Mail wurde automatisch vom SEO Dashboard versendet.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send editorial plan status notification:", error);
    throw error;
  }

  return data;
}

export async function sendWelcomeEmail({
  to,
  invitedBy,
  loginUrl,
}: {
  to: string;
  invitedBy: { name?: string | null; email: string };
  loginUrl: string;
}) {
  const invitedByName = invitedBy.name || invitedBy.email;
  
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: to,
    subject: "Willkommen im SEO Dashboard",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">Willkommen im SEO Dashboard</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Du wurdest von <strong>${invitedByName}</strong> zum SEO Dashboard eingeladen.
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Ab sofort kannst Du Dich mit Deiner E-Mail-Adresse <strong>${to}</strong> im SEO Dashboard anmelden.
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Klicke auf den Button unten, um zur Anmeldeseite zu gelangen. Du erhältst dann einen Magic Link per E-Mail, mit dem Du Dich einloggen kannst.
            </p>
            <a href="${loginUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom: 24px;">
              Zur Anmeldeseite
            </a>
            <p style="color: #a1a1aa; font-size: 14px; margin: 24px 0 0 0; border-top: 1px solid #e4e4e7; padding-top: 24px;">
              Falls Du Fragen hast, wende Dich bitte an ${invitedByName}.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("Failed to send welcome email:", error);
    throw error;
  }

  return data;
}


