import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class ChecklistPage extends StatefulWidget {
  const ChecklistPage({super.key});

  @override
  State<ChecklistPage> createState() => _ChecklistPageState();
}

class _ChecklistPageState extends State<ChecklistPage> {
  late CollectionReference _checklistsRef;
  String patientId = "123";

  bool showDeleteIcons = false; // toggle for individual delete

  @override
  void initState() {
    super.initState();
    _checklistsRef = FirebaseFirestore.instance
        .collection('checklists')
        .doc(patientId)
        .collection('user_checklists');
  }

  // ================= ADD CHECKLIST =================
  void _showAddChecklistDialog() {
    final titleController = TextEditingController();
    final subtitleController = TextEditingController();

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('New Checklist'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: titleController,
              decoration: const InputDecoration(hintText: 'Name of List...'),
            ),
            TextField(
              controller: subtitleController,
              decoration: const InputDecoration(
                hintText: 'Type of Appointment/Event...',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              _checklistsRef.add({
                'title': titleController.text,
                'subtitle': subtitleController.text,
                'items': [],
                'archived': false,
              });
              Navigator.pop(context);
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  // ================= CONFIRM DELETE (Archive) =================
  void _confirmDeleteChecklist(String docId, String title) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Checklist?'),
        content: Text('Are you sure you want to delete: "$title"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('No - Go Back'),
          ),
          ElevatedButton(
            onPressed: () async {
              // Archive instead of deleting
              await _checklistsRef.doc(docId).update({'archived': true});
              // Hide delete icons
              setState(() {
                showDeleteIcons = false;
              });
              Navigator.pop(context);
            },
            child: const Text('Yes, Delete'),
          ),
        ],
      ),
    );
  }

  // ================= ARCHIVE ALL =================
  void _archiveAll() async {
    final snapshot = await _checklistsRef.get();
    for (var doc in snapshot.docs) {
      await doc.reference.update({'archived': true});
    }
  }

  // ================= ITEM FUNCTIONS =================
  void _showAddItemDialog(String docId) {
    final controller = TextEditingController();

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add Item'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(hintText: 'Type item...'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final doc = await _checklistsRef.doc(docId).get();
              final currentItems = List<Map<String, dynamic>>.from(
                doc['items'],
              );
              currentItems.add({'text': controller.text, 'checked': false});
              _checklistsRef.doc(docId).update({'items': currentItems});
              Navigator.pop(context);
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  void _deleteItem(String docId, int index) async {
    final doc = await _checklistsRef.doc(docId).get();
    final currentItems = List<Map<String, dynamic>>.from(doc['items']);
    currentItems.removeAt(index);
    _checklistsRef.doc(docId).update({'items': currentItems});
  }

  void _toggleItem(String docId, int index) async {
    final doc = await _checklistsRef.doc(docId).get();
    final currentItems = List<Map<String, dynamic>>.from(doc['items']);
    currentItems[index]['checked'] = !(currentItems[index]['checked'] as bool);
    _checklistsRef.doc(docId).update({'items': currentItems});
  }

  // ================= UI =================
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Checklists'),
        actions: [
          TextButton(
            onPressed: _showAddChecklistDialog,
            child: const Text('+ Add List'),
          ),
          TextButton(
            onPressed: () {
              setState(() {
                showDeleteIcons = !showDeleteIcons;
              });
            },
            child: const Text('Delete Lists'),
          ),
          TextButton(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ArchivePage(checklistsRef: _checklistsRef),
                ),
              );
            },
            child: const Text('List Archive'),
          ),
        ],
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: _checklistsRef.where('archived', isEqualTo: false).snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final checklists = snapshot.data!.docs;

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: checklists.length,
            itemBuilder: (context, index) {
              final doc = checklists[index];
              final checklist = doc.data() as Map<String, dynamic>;

              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: ChecklistCard(
                  title: checklist['title'],
                  subtitle: checklist['subtitle'],
                  items: List<Map<String, dynamic>>.from(checklist['items']),
                  showDeleteIcon: showDeleteIcons,
                  onDelete: () =>
                      _confirmDeleteChecklist(doc.id, checklist['title']),
                  onAddItem: () => _showAddItemDialog(doc.id),
                  onDeleteItem: (i) => _deleteItem(doc.id, i),
                  onToggleItem: (i) => _toggleItem(doc.id, i),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

// ================= CARD =================
class ChecklistCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<Map<String, dynamic>> items;
  final VoidCallback? onDelete;
  final VoidCallback? onAddItem;
  final Function(int)? onDeleteItem;
  final Function(int)? onToggleItem;
  final bool showDeleteIcon;

  const ChecklistCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.items,
    this.onDelete,
    this.onAddItem,
    this.onDeleteItem,
    this.onToggleItem,
    this.showDeleteIcon = false,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
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
                    Text(subtitle, style: TextStyle(color: Colors.grey[600])),
                  ],
                ),
                if (showDeleteIcon)
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: onDelete,
                  ),
              ],
            ),
            const SizedBox(height: 8),

            // Items
            for (var i = 0; i < items.length; i++)
              Row(
                children: [
                  Checkbox(
                    value: items[i]['checked'],
                    onChanged: (_) => onToggleItem?.call(i),
                  ),
                  Expanded(child: Text(items[i]['text'])),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 20),
                    onPressed: () => onDeleteItem?.call(i),
                  ),
                ],
              ),

            const SizedBox(height: 8),

            // Buttons
            Row(
              children: [
                ElevatedButton(
                  onPressed: onAddItem,
                  child: const Text('+ Add Items'),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () {},
                  child: const Text('- Delete Items'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ================= ARCHIVE PAGE =================
class ArchivePage extends StatelessWidget {
  final CollectionReference checklistsRef;

  const ArchivePage({super.key, required this.checklistsRef});

  void _duplicateChecklist(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    checklistsRef.add({
      'title': data['title'],
      'subtitle': data['subtitle'],
      'items': data['items'],
      'archived': false,
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Archived Lists')),
      body: StreamBuilder<QuerySnapshot>(
        stream: checklistsRef.where('archived', isEqualTo: true).snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final archivedLists = snapshot.data!.docs;

          if (archivedLists.isEmpty) {
            return const Center(child: Text('No archived lists.'));
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: archivedLists.length,
            itemBuilder: (context, index) {
              final doc = archivedLists[index];
              final data = doc.data() as Map<String, dynamic>;

              return Card(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 2,
                margin: const EdgeInsets.only(bottom: 16),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        data['title'],
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        data['subtitle'],
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 8),
                      ElevatedButton(
                        onPressed: () => _duplicateChecklist(doc),
                        child: const Text('Duplicate List'),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
