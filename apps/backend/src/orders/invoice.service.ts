import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateInvoice(
    orderId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { name: true, phone: true, email: true } },
        vendor: {
          select: { businessName: true, city: true, gstNumber: true, user: { select: { phone: true } } },
        },
        quote: {
          include: { items: true },
        },
        directItems: { include: { product: { select: { name: true } } } },
        rfq: { select: { referenceCode: true, title: true } },
        payment: { select: { status: true, razorpayPaymentId: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Access control: buyer or vendor of this order
    if (userRole === UserRole.BUYER && order.buyerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (userRole === UserRole.VENDOR) {
      const vendorProfile = await this.prisma.vendorProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!vendorProfile || order.vendorId !== vendorProfile.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.buildPdf(order);
  }

  private buildPdf(order: {
    id: string;
    referenceCode: string | null;
    totalAmount: { toString(): string };
    status: string;
    paymentMethod: string;
    confirmedAt: Date | null;
    deliveredAt: Date | null;
    buyer: { name: string | null; phone: string; email: string | null };
    vendor: {
      businessName: string;
      city: string;
      gstNumber: string;
      user: { phone: string };
    };
    quote: {
      subtotal: { toString(): string };
      taxAmount: { toString(): string };
      deliveryFee: { toString(): string };
      totalAmount: { toString(): string };
      items: Array<{
        productName: string;
        quantity: { toString(): string };
        unit: string;
        unitPrice: { toString(): string };
        subtotal: { toString(): string };
      }>;
    } | null;
    directItems: Array<{
      productName: string;
      quantity: { toString(): string };
      unit: string;
      unitPrice: { toString(): string };
      subtotal: { toString(): string };
    }>;
    rfq: { referenceCode: string | null; title: string | null } | null;
    payment: { status: string; razorpayPaymentId: string | null } | null;
  }): Promise<Buffer> {
    // Normalise line items regardless of order type
    const lineItems = order.quote
      ? order.quote.items
      : order.directItems;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ─── Header ───────────────────────────────────────────
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('BuildMart', 50, 50)
        .fontSize(10)
        .font('Helvetica')
        .text('Construction Procurement Platform', 50, 75)
        .moveDown();

      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('INVOICE', { align: 'right' })
        .fontSize(10)
        .font('Helvetica')
        .text(`Order: ${order.referenceCode ?? order.id}`, { align: 'right' })
        .text(
          `Date: ${order.confirmedAt ? order.confirmedAt.toLocaleDateString('en-IN') : 'N/A'}`,
          { align: 'right' },
        )
        .moveDown(2);

      // ─── Parties ──────────────────────────────────────────
      const col1X = 50;
      const col2X = 300;
      const startY = doc.y;

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Bill To:', col1X, startY)
        .font('Helvetica')
        .fontSize(10)
        .text(order.buyer.name ?? 'N/A', col1X, doc.y)
        .text(order.buyer.phone, col1X)
        .text(order.buyer.email ?? '', col1X);

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Vendor:', col2X, startY)
        .font('Helvetica')
        .fontSize(10)
        .text(order.vendor.businessName, col2X, startY + 14)
        .text(`GST: ${order.vendor.gstNumber}`, col2X)
        .text(`${order.vendor.city}`, col2X)
        .text(order.vendor.user.phone, col2X);

      doc.moveDown(3);

      // ─── Items Table ──────────────────────────────────────
      const tableTop = doc.y + 10;
      const colWidths = [200, 60, 60, 80, 80];
      const headers = ['Product', 'Qty', 'Unit', 'Unit Price', 'Subtotal'];
      const colX = [50, 250, 310, 370, 450];

      // Header row
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .rect(50, tableTop - 5, 510, 18)
        .fill('#F3F4F6');

      doc.fill('#111111');
      headers.forEach((h, i) => {
        doc.text(h, colX[i], tableTop, { width: colWidths[i] });
      });

      let rowY = tableTop + 20;
      doc.font('Helvetica').fontSize(9);

      for (const item of lineItems) {
        if (rowY > 700) {
          doc.addPage();
          rowY = 50;
        }
        doc.text(item.productName, colX[0], rowY, { width: colWidths[0] });
        doc.text(item.quantity.toString(), colX[1], rowY, { width: colWidths[1] });
        doc.text(item.unit, colX[2], rowY, { width: colWidths[2] });
        doc.text(`₹${item.unitPrice.toString()}`, colX[3], rowY, { width: colWidths[3] });
        doc.text(`₹${item.subtotal.toString()}`, colX[4], rowY, { width: colWidths[4] });
        rowY += 18;
      }

      // Divider
      doc.moveTo(50, rowY + 5).lineTo(560, rowY + 5).stroke();
      rowY += 15;

      // ─── Totals ───────────────────────────────────────────
      const totals: Array<[string, string]> = order.quote
        ? [
            ['Subtotal', `₹${order.quote.subtotal.toString()}`],
            ['Tax', `₹${order.quote.taxAmount.toString()}`],
            ['Delivery Fee', `₹${order.quote.deliveryFee.toString()}`],
            ['TOTAL', `₹${order.quote.totalAmount.toString()}`],
          ]
        : [['TOTAL', `₹${order.totalAmount.toString()}`]];

      const labelX = 380;
      const valueX = 470;

      for (let i = 0; i < totals.length; i++) {
        const [label, value] = totals[i];
        const isLast = i === totals.length - 1;
        if (isLast) {
          doc.font('Helvetica-Bold').fontSize(11);
        } else {
          doc.font('Helvetica').fontSize(9);
        }
        doc.text(label, labelX, rowY, { width: 80 });
        doc.text(value, valueX, rowY, { width: 80, align: 'right' });
        rowY += isLast ? 20 : 15;
      }

      // ─── Payment Info ─────────────────────────────────────
      doc.moveDown(2).font('Helvetica').fontSize(9);
      doc.text(`Payment Method: ${order.paymentMethod}`, 50);
      doc.text(`Payment Status: ${order.payment?.status ?? 'N/A'}`, 50);
      if (order.payment?.razorpayPaymentId) {
        doc.text(`Payment ID: ${order.payment.razorpayPaymentId}`, 50);
      }
      doc.text(`Order Status: ${order.status}`, 50);

      // ─── Footer ───────────────────────────────────────────
      doc
        .moveDown(3)
        .fontSize(8)
        .fillColor('#9CA3AF')
        .text('Thank you for using BuildMart. This is a system-generated invoice.', {
          align: 'center',
        });

      doc.end();
    });
  }
}
