package com.uangku.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.Map;

final class BillReminderScheduler {
    private static final String PREFS = "uangku_bill_reminders_v1";
    private static final String PREFIX = "reminder_";
    private static final SimpleDateFormat DATE = new SimpleDateFormat("yyyy-MM-dd", Locale.US);

    private BillReminderScheduler() {}

    static synchronized void schedule(
        Context context,
        String id,
        String title,
        String amount,
        String dueDate,
        boolean monthly,
        int daysBefore,
        boolean persist
    ) {
        if (context == null || id == null || id.trim().isEmpty() || dueDate == null) return;

        try {
            String effectiveDue = normalizeFutureDueDate(dueDate, monthly);
            if (effectiveDue == null) {
                if (!monthly && persist) removeStored(context, id);
                return;
            }

            if (persist) {
                store(context, id, title, amount, effectiveDue, monthly, daysBefore);
            }

            Date parsed = DATE.parse(effectiveDue);
            if (parsed == null) return;

            Calendar alarm = Calendar.getInstance();
            alarm.setTime(parsed);
            alarm.add(Calendar.DAY_OF_MONTH, -Math.max(0, daysBefore));
            alarm.set(Calendar.HOUR_OF_DAY, 9);
            alarm.set(Calendar.MINUTE, 0);
            alarm.set(Calendar.SECOND, 0);
            alarm.set(Calendar.MILLISECOND, 0);

            if (alarm.getTimeInMillis() < System.currentTimeMillis()) {
                // Reminder terlambat dijadwalkan (misalnya HP baru menyala siang hari).
                // Jika tanggal jatuh tempo belum lewat, tampilkan secepatnya daripada hilang.
                String today = DATE.format(new Date());
                if (effectiveDue.compareTo(today) < 0) return;

                alarm = Calendar.getInstance();
                alarm.add(Calendar.MINUTE, 1);
                alarm.set(Calendar.SECOND, 0);
                alarm.set(Calendar.MILLISECOND, 0);
            }

            Intent intent = new Intent(context, BillReminderReceiver.class);
            intent.putExtra("id", id);
            intent.putExtra("title", title);
            intent.putExtra("amount", amount);
            intent.putExtra("dueDate", effectiveDue);
            intent.putExtra("monthly", monthly);
            intent.putExtra("daysBefore", Math.max(0, daysBefore));

            PendingIntent pi = PendingIntent.getBroadcast(
                context,
                requestCode(id),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.getTimeInMillis(), pi);
            }
        } catch (Exception ignored) {}
    }

    static synchronized void cancel(Context context, String id, boolean removeStored) {
        if (context == null || id == null) return;

        try {
            Intent intent = new Intent(context, BillReminderReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(
                context,
                requestCode(id),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(pi);
            pi.cancel();
        } catch (Exception ignored) {}

        if (removeStored) removeStored(context, id);
    }

    static synchronized void rescheduleAll(Context context) {
        if (context == null) return;

        Map<String, ?> all = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getAll();

        for (Map.Entry<String, ?> entry : all.entrySet()) {
            if (!entry.getKey().startsWith(PREFIX) || !(entry.getValue() instanceof String)) continue;

            try {
                JSONObject obj = new JSONObject((String) entry.getValue());
                schedule(
                    context,
                    obj.optString("id"),
                    obj.optString("title"),
                    obj.optString("amount"),
                    obj.optString("dueDate"),
                    obj.optBoolean("monthly", false),
                    obj.optInt("daysBefore", 0),
                    true
                );
            } catch (Exception ignored) {}
        }
    }

    static synchronized void reminderDelivered(
        Context context,
        String id,
        String title,
        String amount,
        String dueDate,
        boolean monthly,
        int daysBefore
    ) {
        if (monthly) {
            String nextDue = addMonths(dueDate, 1);
            if (nextDue != null) {
                schedule(context, id, title, amount, nextDue, true, daysBefore, true);
            }
        } else {
            removeStored(context, id);
        }
    }

    private static int requestCode(String id) {
        return id.hashCode() & 0x7fffffff;
    }

    private static void store(
        Context context,
        String id,
        String title,
        String amount,
        String dueDate,
        boolean monthly,
        int daysBefore
    ) {
        try {
            JSONObject obj = new JSONObject();
            obj.put("id", id);
            obj.put("title", title == null ? "" : title);
            obj.put("amount", amount == null ? "" : amount);
            obj.put("dueDate", dueDate);
            obj.put("monthly", monthly);
            obj.put("daysBefore", Math.max(0, daysBefore));

            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(PREFIX + id, obj.toString())
                .apply();
        } catch (Exception ignored) {}
    }

    private static void removeStored(Context context, String id) {
        if (context == null || id == null) return;
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(PREFIX + id)
            .apply();
    }

    private static String normalizeFutureDueDate(String dueDate, boolean monthly) {
        try {
            Date parsed = DATE.parse(dueDate);
            if (parsed == null) return null;

            String effective = DATE.format(parsed);
            String today = DATE.format(new Date());

            if (!monthly) {
                return effective.compareTo(today) >= 0 ? effective : null;
            }

            int guard = 0;
            while (effective.compareTo(today) < 0 && guard < 120) {
                effective = addMonths(effective, 1);
                if (effective == null) return null;
                guard++;
            }

            return effective;
        } catch (Exception e) {
            return null;
        }
    }

    private static String addMonths(String dateStr, int months) {
        try {
            Date parsed = DATE.parse(dateStr);
            if (parsed == null) return null;

            Calendar due = Calendar.getInstance();
            due.setTime(parsed);
            int originalDay = due.get(Calendar.DAY_OF_MONTH);

            due.set(Calendar.DAY_OF_MONTH, 1);
            due.add(Calendar.MONTH, months);

            int lastDay = due.getActualMaximum(Calendar.DAY_OF_MONTH);
            due.set(Calendar.DAY_OF_MONTH, Math.min(originalDay, lastDay));
            return DATE.format(due.getTime());
        } catch (Exception e) {
            return null;
        }
    }
}
