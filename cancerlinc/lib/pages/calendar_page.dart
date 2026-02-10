import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';

class CalendarPage extends StatelessWidget {
  const CalendarPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const EventsAppBar(),
      body: const EventsList(),
    );
  }
}

class EventsAppBar extends StatelessWidget implements PreferredSizeWidget {
  const EventsAppBar({super.key});

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: const Text('Events'),
      centerTitle: true,
      leadingWidth: 100,
      leading: Row(
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () {
              // TODO: open options menu
            },
          ),
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {
              // TODO: open filter dialog
            },
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.calendar_today),
          onPressed: () async {
            showModalBottomSheet(
              context: context,
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
              ),
              builder: (context) {
                DateTime focusedDay = DateTime.now();
                DateTime selectedDay = DateTime.now();

                return StatefulBuilder(
                  builder: (context, setState) {
                    return Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: TableCalendar(
                        firstDay: DateTime.utc(2000, 1, 1),
                        lastDay: DateTime.utc(2100, 12, 31),
                        focusedDay: focusedDay,
                        selectedDayPredicate: (day) => isSameDay(day, selectedDay),
                        onDaySelected: (selected, focused) {
                          setState(() {
                            selectedDay = selected;
                            focusedDay = focused;
                          });
                        },
                      ),
                    );
                  },
                );
              },
            );
          },
        ),
        IconButton(
          icon: const Icon(Icons.add),
          onPressed: () {
            // TODO: add new event
          },
        ),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

class EventsList extends StatelessWidget {
  const EventsList({super.key});

  final List<Map<String, String>> events = const [
    {'title': 'Team Meeting', 'time': '10:00 AM - 11:00 AM'},
    {'title': 'Project Review', 'time': '1:00 PM - 2:30 PM'},
    {'title': 'Workout', 'time': '6:00 PM'},
  ];

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: events.length,
      itemBuilder: (context, index) {
        final event = events[index];
        return EventCard(title: event['title']!, time: event['time']!);
      },
    );
  }
}

class EventCard extends StatelessWidget {
  final String title;
  final String time;

  const EventCard({super.key, required this.title, required this.time});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: const Icon(Icons.event, color: Colors.blueAccent),
        title: Text(title, style: Theme.of(context).textTheme.titleMedium),
        subtitle: Text(time),
        onTap: () {
          // TODO: open event details
        },
      ),
    );
  }
}