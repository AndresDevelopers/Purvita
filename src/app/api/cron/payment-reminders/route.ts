import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PaymentNotificationService } from '@/modules/payments/services/payment-notification-service';
import { addDays, formatISO, parseISO as _parseISO, startOfDay } from 'date-fns';

/**
 * Cron job to send payment reminders
 * This should be called daily (e.g., via Vercel Cron or similar)
 * 
 * It checks the payment schedule and sends reminders to users
 * based on the configured reminder_days_before
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const notificationService = new PaymentNotificationService(supabase);

    // Get payment schedule configuration
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('payment_schedule_settings')
      .select('frequency, day_of_month, weekday, reminder_days_before, default_amount_cents, currency')
      .eq('id', true)
      .single();

    if (scheduleError || !scheduleData) {
      console.error('[Payment Reminders] Failed to fetch payment schedule:', scheduleError);
      return NextResponse.json(
        { error: 'Failed to fetch payment schedule' },
        { status: 500 }
      );
    }

    const {
      frequency,
      day_of_month,
      weekday,
      reminder_days_before,
      default_amount_cents,
      currency,
    } = scheduleData;

    if (!reminder_days_before || reminder_days_before.length === 0) {
      console.log('[Payment Reminders] No reminders configured');
      return NextResponse.json({ message: 'No reminders configured', sent: 0 });
    }

    // Calculate next payment date based on frequency
    const today = startOfDay(new Date());
    const nextPaymentDate = calculateNextPaymentDate(today, frequency, day_of_month, weekday);

    if (!nextPaymentDate) {
      console.error('[Payment Reminders] Could not calculate next payment date');
      return NextResponse.json(
        { error: 'Could not calculate next payment date' },
        { status: 500 }
      );
    }

    // Calculate days until payment
    const daysUntilPayment = Math.ceil(
      (nextPaymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if today is a reminder day
    const shouldSendReminder = reminder_days_before.includes(daysUntilPayment);

    if (!shouldSendReminder) {
      console.log(
        `[Payment Reminders] No reminder needed today. Days until payment: ${daysUntilPayment}, Reminder days: ${reminder_days_before.join(', ')}`
      );
      return NextResponse.json({
        message: 'No reminder needed today',
        daysUntilPayment,
        nextPaymentDate: formatISO(nextPaymentDate),
        sent: 0,
      });
    }

    // Get all active users with pending payments
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .not('email', 'is', null);

    if (usersError || !users) {
      console.error('[Payment Reminders] Failed to fetch users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    let sentCount = 0;
    const errors: string[] = [];

    // Send reminders to all users
    for (const user of users) {
      try {
        await notificationService.sendPaymentReminder({
          userEmail: user.email,
          userName: user.name || 'Member',
          amountCents: default_amount_cents,
          currency: currency || 'USD',
          dueDate: formatISO(nextPaymentDate),
          daysUntilDue: daysUntilPayment,
          locale: 'en', // TODO: Get user's preferred locale from profile
        });
        sentCount++;
      } catch (error) {
        const errorMessage = `Failed to send reminder to ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('[Payment Reminders]', errorMessage);
        errors.push(errorMessage);
      }
    }

    console.log(
      `[Payment Reminders] Sent ${sentCount} reminders for payment due on ${formatISO(nextPaymentDate)} (${daysUntilPayment} days)`
    );

    return NextResponse.json({
      message: 'Payment reminders sent',
      sent: sentCount,
      total: users.length,
      daysUntilPayment,
      nextPaymentDate: formatISO(nextPaymentDate),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Payment Reminders] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send payment reminders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate the next payment date based on frequency and configuration
 */
function calculateNextPaymentDate(
  today: Date,
  frequency: string,
  dayOfMonth: number | null,
  weekday: number | null
): Date | null {
  const now = new Date(today);

  switch (frequency) {
    case 'monthly': {
      if (dayOfMonth === null) return null;

      // Start with current month
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);

      // If the day has already passed this month, use next month
      if (currentMonth <= now) {
        return new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
      }

      return currentMonth;
    }

    case 'weekly': {
      if (weekday === null) return null;

      // Get current day of week (0 = Sunday, 6 = Saturday)
      const currentDay = now.getDay();
      let daysUntilNext = weekday - currentDay;

      // If the day has already passed this week, add 7 days
      if (daysUntilNext <= 0) {
        daysUntilNext += 7;
      }

      return addDays(now, daysUntilNext);
    }

    case 'biweekly': {
      if (weekday === null) return null;

      // For biweekly, we need to track the last payment date
      // For now, we'll use the same logic as weekly
      // TODO: Implement proper biweekly tracking with last payment date
      const currentDay = now.getDay();
      let daysUntilNext = weekday - currentDay;

      if (daysUntilNext <= 0) {
        daysUntilNext += 14; // Next occurrence in 2 weeks
      }

      return addDays(now, daysUntilNext);
    }

    default:
      return null;
  }
}

