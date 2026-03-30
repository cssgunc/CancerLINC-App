import 'package:flutter/material.dart';

class ChecklistPage extends StatefulWidget {
  const ChecklistPage({super.key});

  @override
  State<ChecklistPage> createState() => _ChecklistPageState();
}

class _ChecklistPageState extends State<ChecklistPage> {
  final List<Map<String, dynamic>> _checklists = [
    {
      'title': '03/25/26 Appointment',
      'subtitle': 'Routine Oncology',
      'items': [
        'List of Current Medications',
        'Photo ID',
        'Insurance Card',
        'Referral from Primary Care Doctor',
        'Eyeglasses',
      ],
    },
    {
      'title': '04/02/26 Appointment',
      'subtitle': 'Routine Oncology',
      'items': ['List of Current Medications', 'Photo ID'],
    },
  ];

  void _addChecklist() {
    setState(() {
      _checklists.add({
        'title': 'New Checklist',
        'subtitle': 'Type of Appointment',
        'items': ['Placeholder Item'],
      });
    });
  }

  void _deleteChecklist(int index) {
    setState(() {
      _checklists.removeAt(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Checklists'),
        actions: [
          TextButton(onPressed: _addChecklist, child: const Text('Add List')),
          TextButton(onPressed: () {}, child: const Text('Delete Lists')),
          TextButton(onPressed: () {}, child: const Text('List Archive')),
        ],
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _checklists.length,
        itemBuilder: (context, index) {
          final checklist = _checklists[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: ChecklistCard(
              title: checklist['title'],
              subtitle: checklist['subtitle'],
              items: List<String>.from(checklist['items']),
              onDelete: () => _deleteChecklist(index),
            ),
          );
        },
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: 1,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.chat), label: 'Chat'),
          BottomNavigationBarItem(
            icon: Icon(Icons.checklist),
            label: 'Checklist',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.menu_book),
            label: 'Resources',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.calendar_today),
            label: 'Calendar',
          ),
        ],
      ),
    );
  }
}

class ChecklistCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<String> items;
  final VoidCallback? onDelete;

  const ChecklistCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.items,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: onDelete,
                ),
              ],
            ),
            const SizedBox(height: 8),
            for (var item in items)
              Row(
                children: [
                  Checkbox(value: false, onChanged: (_) {}),
                  Text(item),
                ],
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                ElevatedButton(
                  onPressed: () {},
                  child: const Text('Add Items'),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () {},
                  child: const Text('Delete Items'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
