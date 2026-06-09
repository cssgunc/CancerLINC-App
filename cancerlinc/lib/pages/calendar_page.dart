import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';

// ─── Design tokens (match checklist page) ──────────────────────────────────────
const _dark = Color(0xFF3F454F);
const _green = Color(0xFFA0CC39);
const _border = Color(0xFFD9D9D9);
const _placeholder = Color(0xFF999999);

BoxDecoration get _cardDecoration => BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(9),
      border: Border.all(color: _border),
      boxShadow: const [
        BoxShadow(
          color: Color.fromRGBO(0, 0, 0, 0.07),
          blurRadius: 6,
          offset: Offset(0, 2),
        ),
      ],
    );

TextStyle _bold(double size, {Color color = _dark}) =>
    TextStyle(fontSize: size, fontWeight: FontWeight.bold, color: color);

TextStyle _regular(double size, {Color color = _dark}) =>
    TextStyle(fontSize: size, color: color);

// ─── Page ──────────────────────────────────────────────────────────────────────

class CalendarPage extends StatelessWidget {
  const CalendarPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CalendarHeader(),
          Expanded(child: _EventsList()),
        ],
      ),
    );
  }
}

// ─── Header ────────────────────────────────────────────────────────────────────

class _CalendarHeader extends StatelessWidget {
  const _CalendarHeader();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Calendar', style: _bold(24)),
          const SizedBox(height: 12),
          Row(
            children: [
              _GreenButton(
                label: 'Filter',
                icon: Icons.filter_list,
                onPressed: () {
                  // TODO: open filter dialog
                },
              ),
              const SizedBox(width: 8),
              _GreenButton(
                label: 'Pick Date',
                icon: Icons.calendar_today_outlined,
                onPressed: () => _showCalendarPicker(context),
              ),
              const SizedBox(width: 8),
              _GreenButton(
                label: '+ Add Event',
                onPressed: () {
                  // TODO: add new event
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showCalendarPicker(BuildContext context) {
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
              padding: const EdgeInsets.all(16),
              child: TableCalendar(
                firstDay: DateTime.utc(2000, 1, 1),
                lastDay: DateTime.utc(2100, 12, 31),
                focusedDay: focusedDay,
                selectedDayPredicate: (day) => isSameDay(day, selectedDay),
                calendarStyle: CalendarStyle(
                  selectedDecoration: const BoxDecoration(
                    color: _green,
                    shape: BoxShape.circle,
                  ),
                  selectedTextStyle: _bold(14),
                  todayDecoration: BoxDecoration(
                    color: _green.withValues(alpha: 0.3),
                    shape: BoxShape.circle,
                  ),
                  todayTextStyle: _bold(14),
                ),
                headerStyle: HeaderStyle(
                  formatButtonVisible: false,
                  titleCentered: true,
                  titleTextStyle: _bold(16),
                  leftChevronIcon:
                      const Icon(Icons.chevron_left, color: _dark),
                  rightChevronIcon:
                      const Icon(Icons.chevron_right, color: _dark),
                ),
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
  }
}

class _GreenButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback onPressed;

  const _GreenButton({
    required this.label,
    required this.onPressed,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: _green,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 16, color: _dark),
              const SizedBox(width: 4),
            ],
            Text(label, style: _bold(15)),
          ],
        ),
      ),
    );
  }
}

// ─── Events list ───────────────────────────────────────────────────────────────

class _EventsList extends StatelessWidget {
  const _EventsList();

  static const List<Map<String, String>> events = [
    {
      'title': 'Breast Cancer Awareness Walk',
      'time': '8:00 AM - 11:00 AM',
      'date': '26',
      'month': 'APR',
    },
    {
      'title': 'Oncology Nutrition Workshop',
      'time': '10:00 AM - 12:00 PM',
      'date': '30',
      'month': 'APR',
    },
    {
      'title': 'Caregiver Support Group',
      'time': '6:00 PM - 7:30 PM',
      'date': '03',
      'month': 'MAY',
    },
    {
      'title': 'Cancer Survivor Yoga Session',
      'time': '9:00 AM - 10:00 AM',
      'date': '10',
      'month': 'MAY',
    },
    {
      'title': 'Genetic Counseling Info Session',
      'time': '1:00 PM - 2:30 PM',
      'date': '15',
      'month': 'MAY',
    },
    {
      'title': 'CancerLINC Fundraiser Gala',
      'time': '6:30 PM - 9:30 PM',
      'date': '22',
      'month': 'MAY',
    },
    {
      'title': 'Mental Health & Cancer Webinar',
      'time': '11:00 AM - 12:30 PM',
      'date': '05',
      'month': 'JUN',
    },
    {
      'title': 'Colorectal Cancer Screening Drive',
      'time': '8:00 AM - 2:00 PM',
      'date': '14',
      'month': 'JUN',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
      itemCount: events.length,
      itemBuilder: (context, index) {
        final event = events[index];
        return Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: _EventCard(
            title: event['title']!,
            time: event['time']!,
            date: event['date']!,
            month: event['month']!,
          ),
        );
      },
    );
  }
}

// ─── Event Card ────────────────────────────────────────────────────────────────

class _EventCard extends StatelessWidget {
  final String title;
  final String time;
  final String date;
  final String month;

  const _EventCard({
    required this.title,
    required this.time,
    required this.date,
    required this.month,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        // TODO: open event details
      },
      child: Container(
        decoration: _cardDecoration,
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Date badge
            Container(
              width: 48,
              height: 56,
              decoration: BoxDecoration(
                color: _dark,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(date, style: _bold(20).copyWith(color: const Color.fromARGB(236, 255, 255, 255))),
                  Text(month, style: _bold(10).copyWith(color: const Color.fromARGB(236, 255, 255, 255))),
                ],
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: _regular(18)),
                  const SizedBox(height: 2),
                  Text(time, style: _regular(14, color: _placeholder)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
