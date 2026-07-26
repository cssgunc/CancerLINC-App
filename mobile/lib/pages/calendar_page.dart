import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:cancerlinc/models/event.dart';
import 'package:cancerlinc/services/event_service.dart';

// ─── Design tokens (match checklist page) ──────────────────────────────────────
const _dark = Color(0xFF3F454F);
const _green = Color(0xFFA0CC39);
const _border = Color(0xFFD9D9D9);
const _placeholder = Color(0xFF999999);

const List<String> _months = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

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

class CalendarPage extends StatefulWidget {
  const CalendarPage({super.key});

  @override
  State<CalendarPage> createState() => _CalendarPageState();
}

class _CalendarPageState extends State<CalendarPage> {
  final EventService _eventService = EventService();
  final ScrollController _scrollController = ScrollController();

  final Map<String, GlobalKey> _cardKeys = {};

  Set<String> _selectedTags = {};
  DateTime _centerDate = DateTime.now();
  static const int _daysBefore = 30;
  static const int _daysAfter = 90;

  bool _hasScrolledToToday = false;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  List<Event> _applyFilter(List<Event> events) {
    if (_selectedTags.isEmpty) return events;
    return events
        .where((e) => _selectedTags.every((tag) => e.tags.contains(tag)))
        .toList();
  }

  GlobalKey _keyFor(String id) {
    return _cardKeys.putIfAbsent(id, () => GlobalKey());
  }

  bool _isWithinLoadedWindow(DateTime day) {
    final start = _centerDate.subtract(const Duration(days: _daysBefore));
    final end = _centerDate.add(const Duration(days: _daysAfter));
    return !day.isBefore(start) && !day.isAfter(end);
  }

  Future<void> _scrollToDate(DateTime day, List<Event> events) async {
    // If the picked date falls outside the currently loaded window,
    // re-center the query on it instead of scrolling to nothing.
    if (!_isWithinLoadedWindow(day)) {
      setState(() {
        _centerDate = day;
        _cardKeys.clear(); // old keys no longer correspond to the new stream
      });
      // Let the new StreamBuilder frame render before scrolling.
      await Future.delayed(const Duration(milliseconds: 300));
    }

    Event? target;
    for (final e in events) {
      final d = e.start;
      if (!d.isBefore(DateTime(day.year, day.month, day.day))) {
        target = e;
        break;
      }
    }
    target ??= events.isNotEmpty ? events.last : null;
    if (target == null) return;

    await Future.delayed(const Duration(milliseconds: 150));
    final key = _cardKeys[target.id];
    final ctx = key?.currentContext;
    if (ctx != null) {
      await Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
        alignment: 0.1,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: StreamBuilder<List<Event>>(
        stream: _eventService.streamEventsAround(
          centerDate: _centerDate,
          daysBefore: _daysBefore,
          daysAfter: _daysAfter,
        ),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(
              child: Text(
                'Failed to load events.',
                style: _regular(15, color: _placeholder),
              ),
            );
          }
          if (!snapshot.hasData) {
            return const Center(
              child: CircularProgressIndicator(color: _green),
            );
          }

          final allEvents = snapshot.data!;
          final filtered = _applyFilter(allEvents);

          if (!_hasScrolledToToday && filtered.isNotEmpty) {
            _hasScrolledToToday = true;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _scrollToDate(DateTime.now(), filtered);
            });
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CalendarHeader(
                selectedTags: _selectedTags,
                onFilterChanged: (tags) => setState(() => _selectedTags = tags),
                onDatePicked: (day) => _scrollToDate(day, filtered),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Text(
                          allEvents.isEmpty
                              ? 'No events found around this date.'
                              : 'No events match the selected filters.',
                          style: _regular(15, color: _placeholder),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final event = filtered[index];
                          return Padding(
                            key: _keyFor(event.id),
                            padding: const EdgeInsets.only(bottom: 14),
                            child: _EventCard(event: event),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ─── Header ────────────────────────────────────────────────────────────────────

class _CalendarHeader extends StatelessWidget {
  final Set<String> selectedTags;
  final ValueChanged<Set<String>> onFilterChanged;
  final ValueChanged<DateTime> onDatePicked;

  const _CalendarHeader({
    required this.selectedTags,
    required this.onFilterChanged,
    required this.onDatePicked,
  });

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
                label: selectedTags.isEmpty
                    ? 'Filter'
                    : 'Filter (${selectedTags.length})',
                icon: Icons.filter_list,
                onPressed: () => _showFilterSheet(context),
              ),
              const SizedBox(width: 8),
              _GreenButton(
                label: 'Pick Date',
                icon: Icons.calendar_today_outlined,
                onPressed: () => _showCalendarPicker(context),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showFilterSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        var tempSelected = Set<String>.from(selectedTags);

        return StatefulBuilder(
          builder: (context, setState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Filter by Tags', style: _bold(18)),
                  const SizedBox(height: 4),
                  Text(
                    'Events must match all selected tags.',
                    style: _regular(13, color: _placeholder),
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: kSupportedEventTags.map((tag) {
                      final isSelected = tempSelected.contains(tag);
                      return FilterChip(
                        label: Text(tag),
                        selected: isSelected,
                        selectedColor: _green.withValues(alpha: 0.35),
                        checkmarkColor: _dark,
                        labelStyle: _regular(13),
                        onSelected: (value) {
                          setState(() {
                            if (value) {
                              tempSelected.add(tag);
                            } else {
                              tempSelected.remove(tag);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            setState(() => tempSelected.clear());
                          },
                          child: const Text('Clear'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _green,
                          ),
                          onPressed: () {
                            onFilterChanged(tempSelected);
                            Navigator.pop(context);
                          },
                          child: Text('Apply', style: _bold(15)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
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
                  leftChevronIcon: const Icon(Icons.chevron_left, color: _dark),
                  rightChevronIcon: const Icon(
                    Icons.chevron_right,
                    color: _dark,
                  ),
                ),
                onDaySelected: (selected, focused) {
                  setState(() {
                    selectedDay = selected;
                    focusedDay = focused;
                  });
                  Navigator.pop(context);
                  onDatePicked(selected);
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

  const _GreenButton({required this.label, required this.onPressed, this.icon});

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

// ─── Event Card ────────────────────────────────────────────────────────────────

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const _DetailRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: _green),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: _regular(14))),
      ],
    );
  }
}

class _EventCard extends StatelessWidget {
  final Event event;

  const _EventCard({required this.event});

  String get _timeLabel {
    final start = TimeOfDay.fromDateTime(event.start);
    final end = TimeOfDay.fromDateTime(event.end);
    String fmt(TimeOfDay t) {
      final hour = t.hourOfPeriod == 0 ? 12 : t.hourOfPeriod;
      final minute = t.minute.toString().padLeft(2, '0');
      final period = t.period == DayPeriod.am ? 'AM' : 'PM';
      return '$hour:$minute $period';
    }

    return '${fmt(start)} - ${fmt(end)}';
  }

  String get _dateLabel {
    final d = event.start;
    return '${_months[d.month - 1]} ${d.day}, ${d.year}';
  }

  void _showEventDetails(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: _border,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                Text(event.title, style: _bold(20)),
                const SizedBox(height: 12),
                _DetailRow(
                  icon: Icons.calendar_today_outlined,
                  text: _dateLabel,
                ),
                const SizedBox(height: 8),
                _DetailRow(icon: Icons.access_time, text: _timeLabel),
                // if (event.location.trim().isNotEmpty) ...[
                //   const SizedBox(height: 8),
                //   _DetailRow(
                //     icon: Icons.location_on_outlined,
                //     text: event.location,
                //   ),
                // ],
                if (event.tags.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: event.tags.map((tag) {
                      return Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: _green.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(tag, style: _regular(12)),
                      );
                    }).toList(),
                  ),
                ],
                if (event.description.trim().isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Divider(color: _border, height: 1),
                  const SizedBox(height: 16),
                  Text(event.description, style: _regular(15)),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _green,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: () => Navigator.pop(context),
                    child: Text('Close', style: _bold(15)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final date = event.start;
    final dayLabel = date.day.toString().padLeft(2, '0');
    final monthLabel = _months[date.month - 1];

    return GestureDetector(
      onTap: () => _showEventDetails(context),
      child: Container(
        decoration: _cardDecoration,
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
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
                  Text(
                    dayLabel,
                    style: _bold(
                      20,
                    ).copyWith(color: const Color.fromARGB(236, 255, 255, 255)),
                  ),
                  Text(
                    monthLabel,
                    style: _bold(
                      10,
                    ).copyWith(color: const Color.fromARGB(236, 255, 255, 255)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(event.title, style: _regular(18)),
                  const SizedBox(height: 2),
                  Text(_timeLabel, style: _regular(14, color: _placeholder)),
                  if (event.tags.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: event.tags.map((tag) {
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: _green.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(tag, style: _regular(11)),
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// // ─── Events list ─────────────────────────────────────────────────────────────── 
// class _EventsList extends StatelessWidget {
//   const _EventsList();
//   static const List<Map<String, String>> events = [
//     {
//       'title': 'Breast Cancer Awareness Walk',
//       'time': '8:00 AM - 11:00 AM',
//       'date': '26',
//       'month': 'APR',
//     },
//     {
//       'title': 'Oncology Nutrition Workshop',
//       'time': '10:00 AM - 12:00 PM',
//       'date': '30',
//       'month': 'APR',
//     },
//     {
//       'title': 'Caregiver Support Group',
//       'time': '6:00 PM - 7:30 PM',
//       'date': '03',
//       'month': 'MAY',
//     },
//     {
//       'title': 'Cancer Survivor Yoga Session',
//       'time': '9:00 AM - 10:00 AM',
//       'date': '10',
//       'month': 'MAY',
//     },
//     {
//       'title': 'Genetic Counseling Info Session',
//       'time': '1:00 PM - 2:30 PM',
//       'date': '15',
//       'month': 'MAY',
//     },
//     {
//       'title': 'CancerLINC Fundraiser Gala',
//       'time': '6:30 PM - 9:30 PM',
//       'month': 'MAY',
//     },
//     {
//       'title': 'Mental Health & Cancer Webinar',
//       'time': '11:00 AM - 12:30 PM',
//       'date': '05',
//       'month': 'JUN',
//     },
//     {
//       'title': 'Colorectal Cancer Screening Drive',
//       'time': '8:00 AM - 2:00 PM',
//       'date': '14',
//       'month': 'JUN',
//     },
//   ];
//   @override
//   Widget build(BuildContext context) {
//     return ListView.builder(
//       padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
//       itemCount: events.length,
//       itemBuilder: (context, index) {
//         final event = events[index];
//         return Padding(
//           padding: const EdgeInsets.only(bottom: 14),
//           child: _EventCard(
//             title: event['title']!,
//             time: event['time']!,
//             date: event['date']!,
//             month: event['month']!,
//           ),
//         );
//       },
//     );
//   }
// }      
