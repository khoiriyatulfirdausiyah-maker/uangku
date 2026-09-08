package com.uangku.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationCompat;


public class BillReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra("id");
        String title = intent.getStringExtra("title");
        String amount = intent.getStringExtra("amount");
        String dueDate = intent.getStringExtra("dueDate");
        boolean monthly = intent.getBooleanExtra("monthly", false);
        int daysBefore = intent.getIntExtra("daysBefore", 0);

        Intent open = new Intent(context, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(
            context, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, "bill_reminders")
            .setSmallIcon(com.uangku.app.R.drawable.ic_stat_money)
            .setContentTitle("Pengingat tagihan")
            .setContentText((title == null ? "Tagihan" : title) + " • " + (amount == null ? "" : amount))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pending);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(id == null ? (int) System.currentTimeMillis() : (id.hashCode() & 0x7fffffff), builder.build());
        }

        if (id != null && dueDate != null) {
            BillReminderScheduler.reminderDelivered(
                context,
                id,
                title,
                amount,
                dueDate,
                monthly,
                daysBefore
            );
        }
    }
}
