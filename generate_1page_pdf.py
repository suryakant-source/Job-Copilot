import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

def build_1page_pdf(md_filepath, pdf_filepath):
    with open(md_filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    doc = SimpleDocTemplate(
        pdf_filepath,
        pagesize=letter,
        rightMargin=24,
        leftMargin=24,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=17,
        textColor=colors.HexColor('#1E293B'),
        alignment=TA_CENTER,
        spaceAfter=2
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#475569'),
        alignment=TA_CENTER,
        spaceAfter=4
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=11,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=4,
        spaceAfter=2
    )

    h3_style = ParagraphStyle(
        'Heading3_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=10.5,
        textColor=colors.HexColor('#334155'),
        spaceBefore=3,
        spaceAfter=1
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1E293B'),
        alignment=TA_LEFT,
        spaceAfter=2
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=8,
        firstLineIndent=-6,
        spaceAfter=1.5
    )

    story = []
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        if line.startswith('# '):
            title_text = line[2:].strip()
            story.append(Paragraph(title_text, title_style))
        elif line.startswith('## '):
            h2_text = line[3:].strip()
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#CBD5E1'), spaceBefore=4, spaceAfter=2))
            story.append(Paragraph(h2_text.upper(), h2_style))
        elif line.startswith('### '):
            h3_text = line[4:].strip()
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
            formatted = line
            formatted = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', formatted)
            formatted = re.sub(r'\*(.*?)\*', r'<i>\1</i>', formatted)
            if i <= 3 and ('@' in line or '|' in line):
                story.append(Paragraph(formatted, subtitle_style))
            else:
                story.append(Paragraph(formatted, body_style))
        i += 1

    doc.build(story)
    print(f"Successfully generated 1-page PDF: {pdf_filepath}")

base_dir = r"D:\IWT\job-copilot\applications\phonepe-software-engineer-android"
resume_md = os.path.join(base_dir, "resume.md")
resume_1page_pdf = os.path.join(base_dir, "Debasrita_Das_Resume_PhonePe_1Page.pdf")

build_1page_pdf(resume_md, resume_1page_pdf)
