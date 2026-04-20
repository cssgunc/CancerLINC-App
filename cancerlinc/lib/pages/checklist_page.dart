import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

// ─── Design tokens ─────────────────────────────────────────────────────────────
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

class ChecklistPage extends StatefulWidget {
  const ChecklistPage({super.key});

  @override
  State<ChecklistPage> createState() => _ChecklistPageState();
}

class _ChecklistPageState extends State<ChecklistPage> {
  late CollectionReference _checklistsRef;
  String patientId = "123";
  bool showDeleteIcons = false;

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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Text('New Checklist', style: _bold(18)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _StyledTextField(
              controller: titleController,
              hint: 'Name of List...',
            ),
            const SizedBox(height: 12),
            _StyledTextField(
              controller: subtitleController,
              hint: 'Type of Appointment or Event...',
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: _regular(14, color: _placeholder)),
          ),
          _DarkButton(
            label: 'Add',
            onPressed: () {
              _checklistsRef.add({
                'title': titleController.text,
                'subtitle': subtitleController.text,
                'items': [],
                'archived': false,
              });
              Navigator.pop(context);
            },
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Text('Delete Checklist?', style: _bold(18)),
        content: Text(
          'Are you sure you want to delete "$title"?',
          style: _regular(14, color: _placeholder),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: _regular(14, color: _placeholder)),
          ),
          _DarkButton(
            label: 'Delete',
            onPressed: () async {
              final nav = Navigator.of(context);
              await _checklistsRef.doc(docId).update({'archived': true});
              setState(() => showDeleteIcons = false);
              nav.pop();
            },
          ),
        ],
      ),
    );
  }

  // ================= ITEM FUNCTIONS =================
  void _showAddItemDialog(String docId) {
    final controller = TextEditingController();

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Text('Add Item', style: _bold(18)),
        content: _StyledTextField(controller: controller, hint: 'Type item...'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: _regular(14, color: _placeholder)),
          ),
          _DarkButton(
            label: 'Add',
            onPressed: () async {
              final nav = Navigator.of(context);
              final doc = await _checklistsRef.doc(docId).get();
              final currentItems =
                  List<Map<String, dynamic>>.from(doc['items']);
              currentItems.add({'text': controller.text, 'checked': false});
              _checklistsRef.doc(docId).update({'items': currentItems});
              nav.pop();
            },
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
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildPageHeader(context),
          Expanded(
            child: StreamBuilder<QuerySnapshot>(
              stream: _checklistsRef
                  .where('archived', isEqualTo: false)
                  .snapshots(),
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }

                final checklists = snapshot.data!.docs;

                if (checklists.isEmpty) {
                  return Center(
                    child: Text(
                      'No checklists yet.\nTap + Add List to create one.',
                      textAlign: TextAlign.center,
                      style: _regular(16, color: _placeholder),
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                  itemCount: checklists.length,
                  itemBuilder: (context, index) {
                    final doc = checklists[index];
                    final checklist = doc.data() as Map<String, dynamic>;

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: ChecklistCard(
                        title: checklist['title'],
                        subtitle: checklist['subtitle'],
                        items: List<Map<String, dynamic>>.from(
                            checklist['items']),
                        showDeleteIcon: showDeleteIcons,
                        onDelete: () => _confirmDeleteChecklist(
                            doc.id, checklist['title']),
                        onAddItem: () => _showAddItemDialog(doc.id),
                        onDeleteItem: (i) => _deleteItem(doc.id, i),
                        onToggleItem: (i) => _toggleItem(doc.id, i),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPageHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Checklists',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 32),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _GreenButton(
                label: '+ Add List',
                onPressed: _showAddChecklistDialog,
              ),
              const SizedBox(width: 8),
              _GreenButton(
                label: '- Delete Lists',
                onPressed: () =>
                    setState(() => showDeleteIcons = !showDeleteIcons),
              ),
              const SizedBox(width: 8),
              _GreenButton(
                label: 'List Archive',
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) =>
                        ArchivePage(checklistsRef: _checklistsRef),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Shared small widgets ──────────────────────────────────────────────────────

class _GreenButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;

  const _GreenButton({required this.label, required this.onPressed});

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
        alignment: Alignment.center,
        child: Text(label, style: _bold(15)),
      ),
    );
  }
}

class _DarkButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;

  const _DarkButton({required this.label, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: _dark,
          borderRadius: BorderRadius.circular(6),
        ),
        alignment: Alignment.center,
        child: Text(label, style: _bold(16, color: Colors.white)),
      ),
    );
  }
}

class _StyledTextField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;

  const _StyledTextField({required this.controller, required this.hint});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      style: _regular(15),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: _regular(15, color: _placeholder),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: _dark),
        ),
      ),
    );
  }
}

// ─── Checklist Card ────────────────────────────────────────────────────────────

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
    return Container(
      decoration: _cardDecoration,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Text(title, style: _regular(22))),
              if (showDeleteIcon)
                GestureDetector(
                  onTap: onDelete,
                  child: const Padding(
                    padding: EdgeInsets.only(left: 8),
                    child: Icon(Icons.close, size: 20, color: _placeholder),
                  ),
                ),
            ],
          ),

          const SizedBox(height: 2),
          Text(subtitle, style: _regular(14, color: _placeholder)),

          if (items.isNotEmpty) const SizedBox(height: 12),

          // Items
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: Checkbox(
                      value: items[i]['checked'],
                      onChanged: (_) => onToggleItem?.call(i),
                      activeColor: _green,
                      checkColor: _dark,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(3),
                      ),
                      side: const BorderSide(color: _border, width: 1.5),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      items[i]['text'],
                      style: _regular(
                        15,
                        color: items[i]['checked'] ? _placeholder : _dark,
                      ).copyWith(
                        decoration: items[i]['checked']
                            ? TextDecoration.lineThrough
                            : null,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => onDeleteItem?.call(i),
                    child: const Padding(
                      padding: EdgeInsets.only(left: 8),
                      child: Icon(Icons.delete_outline,
                          size: 18, color: _placeholder),
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 14),

          // Card action buttons
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: onAddItem,
                  child: Container(
                    height: 40,
                    decoration: BoxDecoration(
                      color: _dark,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    alignment: Alignment.center,
                    child: Text('+ Add Items',
                        style: _bold(15, color: Colors.white)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: _dark,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  alignment: Alignment.center,
                  child: Text('- Delete Items',
                      style: _bold(15, color: Colors.white)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Archive Page ──────────────────────────────────────────────────────────────

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
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: _dark,
        elevation: 0,
        title: Text('Archived Lists', style: _bold(18)),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: _border),
        ),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: checklistsRef.where('archived', isEqualTo: true).snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final archivedLists = snapshot.data!.docs;

          if (archivedLists.isEmpty) {
            return Center(
              child: Text(
                'No archived lists.',
                style: _regular(16, color: _placeholder),
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            itemCount: archivedLists.length,
            itemBuilder: (context, index) {
              final doc = archivedLists[index];
              final data = doc.data() as Map<String, dynamic>;

              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Container(
                  decoration: _cardDecoration,
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(data['title'], style: _regular(22)),
                      const SizedBox(height: 2),
                      Text(data['subtitle'],
                          style: _regular(14, color: _placeholder)),
                      const SizedBox(height: 14),
                      GestureDetector(
                        onTap: () => _duplicateChecklist(doc),
                        child: Container(
                          height: 40,
                          decoration: BoxDecoration(
                            color: _dark,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          alignment: Alignment.center,
                          child: Text('Duplicate List',
                              style: _bold(15, color: Colors.white)),
                        ),
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
