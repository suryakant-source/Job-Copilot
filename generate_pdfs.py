import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

def build_pdf(md_filepath, pdf_filepath, is_cover_letter=False):
    with open(md_filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    doc = SimpleDocTemplate(
        pdf_filepath,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom Clean Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20 if not is_cover_letter else 16,
        leading=24,
        textColor=colors.HexColor('#1E293B'),
        alignment=TA_CENTER if not is_cover_letter else TA_LEFT,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#475569'),
        alignment=TA_CENTER if not is_cover_letter else TA_LEFT,
        spaceAfter=10
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=10,
        spaceAfter=4
    )

    h3_style = ParagraphStyle(
        'Heading3_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#334155'),
        spaceBefore=6,
        spaceAfter=2
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#1E293B'),
        alignment=TA_LEFT if not is_cover_letter else TA_JUSTIFY,
        spaceAfter=4
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    story = []
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # Header Title (# DEBASRITA DAS)
        if line.startswith('# '):
            title_text = line[2:].strip()
            story.append(Paragraph(title_text, title_style))
        elif line.startswith('## '):
            h2_text = line[3:].strip()
            story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#CBD5E1'), spaceBefore=8, spaceAfter=4))
            story.append(Paragraph(h2_text.upper(), h2_style))
        elif line.startswith('### '):
            h3_text = line[4:].strip()
            # Convert markdown bold in headings
            h3_text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', h3_text)
            h3_text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', h3_text)
            story.append(Paragraph(h3_text, h3_style))
        elif line.startswith('- ') or line.startswith('* '):
            bullet_text = line[2:].strip()
            bullet_text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', bullet_text)
            bullet_text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', bullet_text)
            story.append(Paragraph(f"• {bullet_text}", bullet_style))
        elif line == '---':
            pass
        else:
            # Check subtitle lines (contact line right after title)
            formatted = line
            formatted = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', formatted)
            formatted = re.sub(r'\*(.*?)\*', r'<i>\1</i>', formatted)
            if i <= 3 and ('@' in line or '|' in line):
                story.append(Paragraph(formatted, subtitle_style))
            else:
                story.append(Paragraph(formatted, body_style))
        i += 1

    doc.build(story)
    print(f"Successfully generated: {pdf_filepath}")

base_dir = r"D:\IWT\job-copilot\applications\phonepe-software-engineer-android"
resume_md = os.path.join(base_dir, "resume.md")
resume_pdf = os.path.join(base_dir, "Debasrita_Das_Resume_PhonePe.pdf")

cover_md = os.path.join(base_dir, "cover-letter.md")
cover_pdf = os.path.join(base_dir, "Debasrita_Das_Cover_Letter_PhonePe.pdf")

build_pdf(resume_md, resume_pdf, is_cover_letter=False)
build_pdf(cover_md, cover_pdf, is_cover_letter=True)
