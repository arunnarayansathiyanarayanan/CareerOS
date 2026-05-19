import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
} from "docx";
import { eq } from "drizzle-orm";
import React from "react";
import {
  Document as PdfDocument,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";

import { getDb } from "@/db";
import { resumeVariants } from "@/db/schema/resume";
import type { GeneratedVariantContent } from "@/lib/resume/types";

const FONT = "Calibri";
const BODY_SIZE = 22; // 11pt in half-points
const HEADER_SIZE = 24; // 12pt
const NAME_SIZE = 28; // 14pt
const BLACK = "000000";

const mmToPt = (mm: number) => (mm * 72) / 25.4;

let r2Client: S3Client | undefined;

function getR2Endpoint(): string {
  const endpoint = process.env.R2_ENDPOINT?.trim();
  if (endpoint) return endpoint;

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  if (accountId) {
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }

  throw new Error("Missing R2_ENDPOINT or R2_ACCOUNT_ID");
}

function getR2Bucket(): string {
  const bucket =
    process.env.R2_BUCKET?.trim() ?? process.env.R2_BUCKET_NAME?.trim();
  if (!bucket) {
    throw new Error("Missing R2_BUCKET or R2_BUCKET_NAME");
  }
  return bucket;
}

function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY");
  }

  const config: S3ClientConfig = {
    region: "auto",
    endpoint: getR2Endpoint(),
    credentials: { accessKeyId, secretAccessKey },
  };

  r2Client = new S3Client(config);
  return r2Client;
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) || /^[\w.-]+\.[a-z]{2,}/i.test(value.trim());
}

function exportStorageKeys(variantId: string) {
  const base = `resumes/exports/${variantId}`;
  return {
    pdfKey: `${base}/resume.pdf`,
    docxKey: `${base}/resume.docx`,
  };
}

function atsBadgeColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function bodyRun(text: string, options?: { bold?: boolean; size?: number }) {
  return new TextRun({
    text,
    font: FONT,
    size: options?.size ?? BODY_SIZE,
    bold: options?.bold ?? false,
    color: BLACK,
  });
}

function sectionHeaderParagraph(title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border: {
      bottom: {
        color: BLACK,
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        font: FONT,
        size: HEADER_SIZE,
        bold: true,
        color: BLACK,
      }),
    ],
  });
}

function bulletParagraph(text: string, indent = false): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    indent: indent ? { left: 360 } : undefined,
    children: [bodyRun(`• ${text}`)],
  });
}

function plainParagraph(text: string, options?: { bold?: boolean }): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [bodyRun(text, { bold: options?.bold })],
  });
}

function hyperlinkParagraph(url: string, label?: string): Paragraph {
  const href = normalizeUrl(url);
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new ExternalHyperlink({
        link: href,
        children: [
          new TextRun({
            text: label ?? url,
            font: FONT,
            size: BODY_SIZE,
            color: BLACK,
            underline: {},
          }),
        ],
      }),
    ],
  });
}

function buildContactParagraph(variant: GeneratedVariantContent): Paragraph {
  const { contact, careerOsLink } = variant;
  const parts: Array<TextRun | ExternalHyperlink> = [];
  let needsSep = false;

  const addSep = () => {
    if (needsSep) {
      parts.push(bodyRun(" | "));
    }
    needsSep = true;
  };

  const addText = (value: string | null | undefined) => {
    if (!value?.trim()) return;
    addSep();
    parts.push(bodyRun(value.trim()));
  };

  const addLink = (value: string | null | undefined, label?: string) => {
    if (!value?.trim()) return;
    addSep();
    const href = normalizeUrl(value.trim());
    parts.push(
      new ExternalHyperlink({
        link: href,
        children: [
          new TextRun({
            text: label ?? value.trim(),
            font: FONT,
            size: BODY_SIZE,
            color: BLACK,
            underline: {},
          }),
        ],
      })
    );
  };

  addText(contact.email);
  addText(contact.phone);
  addText(contact.location);
  addLink(contact.linkedin);
  addLink(contact.github);
  if (careerOsLink?.trim()) {
    addLink(careerOsLink.trim(), "Aihired Profile");
  }

  return new Paragraph({
    spacing: { after: 120 },
    children: parts.length > 0 ? parts : [bodyRun("")],
  });
}

export async function exportDocx(
  variant: GeneratedVariantContent,
  _atsScore: number
): Promise<Buffer> {
  const children: Paragraph[] = [];
  const name = variant.contact.name?.trim();

  if (name) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: name,
            font: FONT,
            size: NAME_SIZE,
            bold: true,
            color: BLACK,
          }),
        ],
      })
    );
  }

  children.push(buildContactParagraph(variant));
  children.push(new Paragraph({ children: [bodyRun("")] }));

  if (variant.summary?.trim()) {
    children.push(sectionHeaderParagraph("SUMMARY"));
    children.push(plainParagraph(variant.summary.trim()));
  }

  if (variant.experience.length > 0) {
    children.push(sectionHeaderParagraph("EXPERIENCE"));
    for (const role of variant.experience) {
      children.push(
        plainParagraph(`${role.company} — ${role.title}`, { bold: true })
      );
      if (role.duration?.trim()) {
        children.push(plainParagraph(role.duration.trim()));
      }
      for (const bullet of role.bullets) {
        if (bullet.trim()) children.push(bulletParagraph(bullet.trim(), true));
      }
    }
  }

  if (variant.skills.length > 0) {
    children.push(sectionHeaderParagraph("SKILLS"));
    for (const skill of variant.skills) {
      if (skill.trim()) children.push(bulletParagraph(skill.trim()));
    }
  }

  if (variant.projects.length > 0) {
    children.push(sectionHeaderParagraph("PROJECTS"));
    for (const project of variant.projects) {
      children.push(plainParagraph(project.name, { bold: true }));
      if (project.description?.trim()) {
        children.push(plainParagraph(project.description.trim()));
      }
      if (project.stack.length > 0) {
        children.push(
          plainParagraph(`Stack: ${project.stack.join(", ")}`)
        );
      }
      if (project.outcome?.trim()) {
        children.push(plainParagraph(project.outcome.trim()));
      }
    }
  }

  if (variant.education.length > 0) {
    children.push(sectionHeaderParagraph("EDUCATION"));
    for (const edu of variant.education) {
      const line = [edu.degree, edu.institution, edu.year]
        .filter((part) => part?.trim())
        .join(" · ");
      if (line) children.push(bulletParagraph(line));
    }
  }

  if (variant.certifications.length > 0) {
    children.push(sectionHeaderParagraph("CERTIFICATIONS"));
    for (const cert of variant.certifications) {
      const line = [cert.name, cert.issuer, cert.year]
        .filter((part) => part?.trim())
        .join(" · ");
      if (line) children.push(bulletParagraph(line));
    }
  }

  if (variant.careerOsLink?.trim()) {
    children.push(sectionHeaderParagraph("AIHIRED LINK"));
    children.push(
      isHttpUrl(variant.careerOsLink)
        ? hyperlinkParagraph(variant.careerOsLink)
        : plainParagraph(variant.careerOsLink)
    );
  }

  const featured =
    variant.featuredProjects?.filter((p) => p.trim()).join(" | ") ?? "";

  children.push(
    plainParagraph(`Aihired Profile: ${variant.careerOsLink}`)
  );
  if (featured) {
    children.push(plainParagraph(`Featured Projects: ${featured}`));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111827",
  },
  header: {
    backgroundColor: "#0F0F0F",
    padding: 16,
    position: "relative",
  },
  headerContent: {
    paddingRight: 64,
  },
  name: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  headline: {
    color: "#6366F1",
    fontSize: 11,
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    color: "#9CA3AF",
    fontSize: 9,
  },
  contactItem: {
    color: "#9CA3AF",
    fontSize: 9,
  },
  badgeWrap: {
    position: "absolute",
    top: 16,
    right: 16,
    alignItems: "center",
  },
  badgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeScore: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  badgeLabel: {
    color: "#FFFFFF",
    fontSize: 7,
    marginTop: 2,
    textAlign: "center",
  },
  body: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    flexGrow: 1,
  },
  sectionHeader: {
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 1,
    color: "#6366F1",
    textTransform: "uppercase",
    borderBottom: "1pt solid #6366F1",
    marginBottom: 6,
    paddingBottom: 2,
    marginTop: 14,
  },
  bodyText: {
    fontSize: 10,
    color: "#111827",
    lineHeight: 1.6,
    marginBottom: 4,
  },
  roleTitle: {
    fontSize: 10,
    color: "#111827",
    fontWeight: "bold",
    lineHeight: 1.6,
    marginBottom: 2,
  },
  bullet: {
    fontSize: 10,
    color: "#111827",
    lineHeight: 1.6,
    marginBottom: 3,
    paddingLeft: 4,
  },
  footer: {
    borderTop: "1pt solid #E5E7EB",
    marginTop: 16,
    paddingTop: 8,
    fontSize: 8,
    color: "#6B7280",
  },
  footerLine: {
    fontSize: 8,
    color: "#6B7280",
    marginBottom: 4,
  },
});

function PdfSectionHeader({ title }: { title: string }) {
  return React.createElement(Text, { style: pdfStyles.sectionHeader }, title);
}

function PdfBullet({ text }: { text: string }) {
  return React.createElement(
    Text,
    { style: pdfStyles.bullet },
    `– ${text}`
  );
}

function PdfBodyText({ text, bold }: { text: string; bold?: boolean }) {
  return React.createElement(
    Text,
    { style: bold ? pdfStyles.roleTitle : pdfStyles.bodyText },
    text
  );
}

function pdfHeadlineFromSummary(summary: string | null | undefined): string {
  if (!summary?.trim()) return "";
  const trimmed = summary.trim();
  const firstSentence = /^.+?[.!?](?:\s|$)/u.exec(trimmed)?.[0]?.trim();
  const headline = firstSentence ?? trimmed.split("\n")[0] ?? trimmed;
  return headline.length > 140 ? `${headline.slice(0, 137)}...` : headline;
}

function buildPdfContactItems(variant: GeneratedVariantContent): string[] {
  const { contact } = variant;
  const items: string[] = [];
  if (contact.email?.trim()) items.push(contact.email.trim());
  if (contact.phone?.trim()) items.push(contact.phone.trim());
  if (contact.location?.trim()) items.push(contact.location.trim());
  if (contact.linkedin?.trim()) items.push(contact.linkedin.trim());
  if (contact.github?.trim()) items.push(contact.github.trim());
  if (variant.careerOsLink?.trim()) items.push(variant.careerOsLink.trim());
  return items;
}

function buildResumePdfDocument(
  variant: GeneratedVariantContent,
  atsScore: number
): React.ReactElement<DocumentProps> {
  const name = variant.contact.name?.trim() ?? "Resume";
  const headline = pdfHeadlineFromSummary(variant.summary);
  const contactItems = buildPdfContactItems(variant);
  const badgeColor = atsBadgeColor(atsScore);
  const featured =
    variant.featuredProjects?.filter((p) => p.trim()).join(" | ") ?? "";

  const bodyChildren: React.ReactNode[] = [];

  if (variant.summary?.trim()) {
    bodyChildren.push(
      React.createElement(PdfSectionHeader, { key: "h-summary", title: "SUMMARY" }),
      React.createElement(PdfBodyText, {
        key: "summary",
        text: variant.summary.trim(),
      })
    );
  }

  if (variant.experience.length > 0) {
    bodyChildren.push(
      React.createElement(PdfSectionHeader, {
        key: "h-exp",
        title: "EXPERIENCE",
      })
    );
    for (const [i, role] of variant.experience.entries()) {
      bodyChildren.push(
        React.createElement(PdfBodyText, {
          key: `exp-title-${i}`,
          text: `${role.company} — ${role.title}`,
          bold: true,
        })
      );
      if (role.duration?.trim()) {
        bodyChildren.push(
          React.createElement(PdfBodyText, {
            key: `exp-dur-${i}`,
            text: role.duration.trim(),
          })
        );
      }
      for (const [j, bullet] of role.bullets.entries()) {
        if (bullet.trim()) {
          bodyChildren.push(
            React.createElement(PdfBullet, {
              key: `exp-b-${i}-${j}`,
              text: bullet.trim(),
            })
          );
        }
      }
    }
  }

  if (variant.skills.length > 0) {
    bodyChildren.push(
      React.createElement(PdfSectionHeader, { key: "h-skills", title: "SKILLS" })
    );
    for (const [i, skill] of variant.skills.entries()) {
      if (skill.trim()) {
        bodyChildren.push(
          React.createElement(PdfBullet, { key: `skill-${i}`, text: skill.trim() })
        );
      }
    }
  }

  if (variant.projects.length > 0) {
    bodyChildren.push(
      React.createElement(PdfSectionHeader, {
        key: "h-projects",
        title: "PROJECTS",
      })
    );
    for (const [i, project] of variant.projects.entries()) {
      bodyChildren.push(
        React.createElement(PdfBodyText, {
          key: `proj-name-${i}`,
          text: project.name,
          bold: true,
        })
      );
      if (project.description?.trim()) {
        bodyChildren.push(
          React.createElement(PdfBodyText, {
            key: `proj-desc-${i}`,
            text: project.description.trim(),
          })
        );
      }
      if (project.stack.length > 0) {
        bodyChildren.push(
          React.createElement(PdfBodyText, {
            key: `proj-stack-${i}`,
            text: `Stack: ${project.stack.join(", ")}`,
          })
        );
      }
      if (project.outcome?.trim()) {
        bodyChildren.push(
          React.createElement(PdfBodyText, {
            key: `proj-out-${i}`,
            text: project.outcome.trim(),
          })
        );
      }
    }
  }

  if (variant.education.length > 0) {
    bodyChildren.push(
      React.createElement(PdfSectionHeader, {
        key: "h-edu",
        title: "EDUCATION",
      })
    );
    for (const [i, edu] of variant.education.entries()) {
      const line = [edu.degree, edu.institution, edu.year]
        .filter((part) => part?.trim())
        .join(" · ");
      if (line) {
        bodyChildren.push(
          React.createElement(PdfBullet, { key: `edu-${i}`, text: line })
        );
      }
    }
  }

  if (variant.certifications.length > 0) {
    bodyChildren.push(
      React.createElement(PdfSectionHeader, {
        key: "h-cert",
        title: "CERTIFICATIONS",
      })
    );
    for (const [i, cert] of variant.certifications.entries()) {
      const line = [cert.name, cert.issuer, cert.year]
        .filter((part) => part?.trim())
        .join(" · ");
      if (line) {
        bodyChildren.push(
          React.createElement(PdfBullet, { key: `cert-${i}`, text: line })
        );
      }
    }
  }

  if (variant.careerOsLink?.trim()) {
    bodyChildren.push(
      React.createElement(PdfSectionHeader, {
        key: "h-careeros",
        title: "AIHIRED LINK",
      }),
      React.createElement(PdfBodyText, {
        key: "careeros-link",
        text: variant.careerOsLink.trim(),
      })
    );
  }

  bodyChildren.push(
    React.createElement(
      View,
      { key: "footer", style: pdfStyles.footer },
      React.createElement(
        Text,
        { style: pdfStyles.footerLine },
        `Aihired Profile: ${variant.careerOsLink}`
      ),
      featured
        ? React.createElement(
            Text,
            { style: pdfStyles.footerLine },
            `Featured Projects: ${featured}`
          )
        : null
    )
  );

  return React.createElement(
    PdfDocument,
    null,
    React.createElement(
      Page,
      {
        size: "A4",
        style: {
          ...pdfStyles.page,
          paddingTop: mmToPt(18),
          paddingBottom: mmToPt(18),
          paddingLeft: mmToPt(16),
          paddingRight: mmToPt(16),
        },
      },
      React.createElement(
        View,
        { style: pdfStyles.header },
        React.createElement(
          View,
          { style: pdfStyles.badgeWrap },
          React.createElement(
            View,
            { style: { ...pdfStyles.badgeCircle, backgroundColor: badgeColor } },
            React.createElement(Text, { style: pdfStyles.badgeScore }, String(atsScore))
          ),
          React.createElement(Text, { style: pdfStyles.badgeLabel }, "ATS")
        ),
        React.createElement(
          View,
          { style: pdfStyles.headerContent },
          React.createElement(Text, { style: pdfStyles.name }, name),
          headline
            ? React.createElement(Text, { style: pdfStyles.headline }, headline)
            : null,
          contactItems.length > 0
            ? React.createElement(
                View,
                { style: pdfStyles.contactRow },
                contactItems.map((item, index) =>
                  React.createElement(
                    Text,
                    { key: `contact-${index}`, style: pdfStyles.contactItem },
                    item
                  )
                )
              )
            : null
        )
      ),
      React.createElement(View, { style: pdfStyles.body }, ...bodyChildren)
    )
  ) as React.ReactElement<DocumentProps>;
}

export async function exportPdf(
  variant: GeneratedVariantContent,
  atsScore: number
): Promise<Buffer> {
  const element = buildResumePdfDocument(variant, atsScore);
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}

export async function generateAndUploadExports(
  variantId: string,
  variant: GeneratedVariantContent,
  atsScore: number
): Promise<{ pdfUrl: string; docxUrl: string }> {
  const { pdfKey, docxKey } = exportStorageKeys(variantId);
  const bucket = getR2Bucket();
  const client = getR2Client();

  const [pdfBuffer, docxBuffer] = await Promise.all([
    exportPdf(variant, atsScore),
    exportDocx(variant, atsScore),
  ]);

  await Promise.all([
    client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: pdfKey,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      })
    ),
    client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: docxKey,
        Body: docxBuffer,
        ContentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    ),
  ]);

  const db = getDb();
  await db
    .update(resumeVariants)
    .set({
      pdfStorageKey: pdfKey,
      docxStorageKey: docxKey,
    })
    .where(eq(resumeVariants.id, variantId));

  const [pdfUrl, docxUrl] = await Promise.all([
    getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: pdfKey }),
      { expiresIn: 3600 }
    ),
    getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: docxKey }),
      { expiresIn: 3600 }
    ),
  ]);

  return { pdfUrl, docxUrl };
}
