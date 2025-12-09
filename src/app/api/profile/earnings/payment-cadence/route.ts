import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/profile/earnings/payment-cadence
 *
 * Obtiene la configuración de payment cadence configurada por el admin.
 * Los usuarios pueden ver esta configuración para entender cómo funcionan
 * los pagos automáticos o manuales.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener la configuración de payment schedule desde la tabla
    const { data: schedule, error: scheduleError } = await supabase
      .from('payment_schedule_settings')
      .select('*')
      .eq('id', true)
      .single();

    if (scheduleError) {
      console.error('Error fetching payment schedule:', scheduleError);
      return NextResponse.json(
        { error: 'Failed to fetch payment cadence configuration' },
        { status: 500 }
      );
    }

    // Si no existe configuración, devolver valores por defecto
    if (!schedule) {
      return NextResponse.json({
        frequency: 'monthly',
        dayOfMonth: 10,
        weekday: null,
        reminderDaysBefore: [3, 1],
        defaultAmountCents: 3499,
        currency: 'USD',
        paymentMode: 'automatic',
        updatedAt: new Date().toISOString(),
      });
    }

    // Transformar snake_case a camelCase para el cliente
    return NextResponse.json({
      frequency: schedule.frequency,
      dayOfMonth: schedule.day_of_month,
      weekday: schedule.weekday,
      reminderDaysBefore: schedule.reminder_days_before || [],
      defaultAmountCents: schedule.default_amount_cents,
      currency: schedule.currency,
      paymentMode: schedule.payment_mode,
      updatedAt: schedule.updated_at,
    });
  } catch (error) {
    console.error('Unexpected error in payment-cadence route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
