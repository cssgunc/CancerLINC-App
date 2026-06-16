import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:cancerlinc/models/checklist.dart';
import 'package:cancerlinc/services/checklist_service.dart';

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
  final ValueChanged<bool>? onUnsavedChanges;
  const ChecklistPage({super.key, this.onUnsavedChanges});

  @override
  State<ChecklistPage> createState() => ChecklistPageState();
}

class ChecklistPageState extends State<ChecklistPage> {
  
  final ChecklistService _checklistService = ChecklistService();
  bool showDeleteIcons = false;
  late CollectionReference _checklistsRef;
  List<Map<String, dynamic>> _localChecklists = [];
  List<Map<String, dynamic>> _savedChecklists = [];
  bool _isLoading = true;

  // when local is diff from saved, show "Save" button in app bar
  bool get _hasUnsavedChanges {
    if (_localChecklists.length != _savedChecklists.length) return true;
    for (int i = 0; i < _localChecklists.length; i++) {
      final local = _localChecklists[i];
      final saved = _savedChecklists[i];
      if (local['docId'] != saved['docId']) return true;
      if (local['title'] != saved['title']) return true;
      if (local['subtitle'] != saved['subtitle']) return true;
      if (local['archived'] != saved['archived']) return true;

      final localItems = local['items'] as List;
      final savedItems = saved['items'] as List;
      if (localItems.length != savedItems.length) return true;
      for (int j = 0; j < localItems.length; j++) {
        if (localItems[j]['text'] != savedItems[j]['text']) return true;
        if (localItems[j]['checked'] != savedItems[j]['checked']) return true;
      }
    }
    return false;
  }

  // called after every mutation so BottomBar always knows current unsaved state
  void _notifyUnsavedChanges() {
    widget.onUnsavedChanges?.call(_hasUnsavedChanges);
  }

  // ================= DEEPCOPY METHOD HELPER =================
  List<Map<String, dynamic>> _deepCopy(List<Map<String, dynamic>> source) {
    return source.map((c) {
      return {
        ...c,
        'items': List<Map<String, dynamic>>.from(
          (c['items'] as List).map((item) => Map<String, dynamic>.from(item)),
        ),
      };
    }).toList();
  }

  int _localIndexByDocId(String docId) =>
      _localChecklists.indexWhere((c) => c['docId'] == docId);

  @override
  void initState() {
    super.initState();
    final userId = _checklistService.currentUserId ?? '';
    _checklistsRef = FirebaseFirestore.instance
        .collection('checklists')
        .doc(userId)
        .collection('user_checklists');
    _loadChecklists();
  }

  // ================= LOAD CHECKLISTS ================= (load in one shot instead of stream)
  Future<void> _loadChecklists() async {
    final snapshot =
        await _checklistsRef.where('archived', isEqualTo: false).get();

    final loaded = snapshot.docs.map((doc) {
      final data = doc.data() as Map<String, dynamic>;
      return {
        'docId': doc.id,
        'title': data['title'],
        'subtitle': data['subtitle'],
        'items': List<Map<String, dynamic>>.from(data['items']),
        'archived': data['archived'],
      };
    }).toList();

    setState(() {
      // deepcopy so _savedChecklists and _localChecklists don't share references
      _savedChecklists = _deepCopy(loaded);
      _localChecklists = _deepCopy(loaded);
      _isLoading = false;
    });
    _notifyUnsavedChanges();
  }

// ================= SAVE CHECKLISTS ================= (call new batch service)
  Future<void> save() async {
    final updatedChecklists = await _checklistService.saveChecklists(_checklistsRef, _localChecklists);
    setState(() {
      // make deep copy to avoid reference issues where changing one changes the other
      _localChecklists = _deepCopy(updatedChecklists);
      _savedChecklists = _deepCopy(updatedChecklists);
    });
    _notifyUnsavedChanges();
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
              final tempId = 'local_${DateTime.now().millisecondsSinceEpoch}';
              setState(() {
                _localChecklists.add({
                  'docId': tempId,
                  'title': titleController.text,
                  'subtitle': subtitleController.text,
                  'items': <Map<String, dynamic>>[],
                  'archived': false,
                });
              });
              _notifyUnsavedChanges();
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
            onPressed: () {
              final i = _localIndexByDocId(docId);
              if (i != -1) {
                setState(() => _localChecklists[i]['archived'] = true);
              }
              setState(() => showDeleteIcons = false);
              _notifyUnsavedChanges();
              Navigator.pop(context);
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
            onPressed: () {
              final i = _localIndexByDocId(docId);
              if (i != -1) {
                setState(() {
                  (_localChecklists[i]['items'] as List<Map<String, dynamic>>)
                      .add({'text': controller.text, 'checked': false});
                });
              }
              _notifyUnsavedChanges();
              Navigator.pop(context);
            },
          ),
        ],
      ),
    );
  }

  void _deleteItem(String docId, int index) {
    final i = _localIndexByDocId(docId);
    if (i != -1) {
      setState(() {
        (_localChecklists[i]['items'] as List).removeAt(index);
      });
      _notifyUnsavedChanges();
    }
  }

  void _toggleItem(String docId, int index) {
    final i = _localIndexByDocId(docId);
    if (i != -1) {
      setState(() {
        final items = _localChecklists[i]['items'] as List<Map<String, dynamic>>;
        items[index]['checked'] = !(items[index]['checked'] as bool);
      });
      _notifyUnsavedChanges();
    }
  }

  // ================= UI =================
  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const SafeArea(child: Center(child: CircularProgressIndicator()));
    }

    final visible = _localChecklists.where((c) => c['archived'] == false).toList();

    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildPageHeader(context),
          Expanded(
            child: visible.isEmpty
                ? Center(
                    child: Text(
                      'No checklists yet.\nTap + Add List to create one.',
                      textAlign: TextAlign.center,
                      style: _regular(16, color: _placeholder),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                    itemCount: visible.length,
                    itemBuilder: (context, index) {
                      final checklist = visible[index];
                      final docId = checklist['docId'] as String;

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: ChecklistCard(
                          title: checklist['title'],
                          subtitle: checklist['subtitle'],
                          items: List<ChecklistItem>.from(
                            (checklist['items'] as List).map(
                              (e) => ChecklistItem(
                                text: e['text'],
                                checked: e['checked'],
                              ),
                            ),
                          ),
                          showDeleteIcon: showDeleteIcons,
                          onDelete: () =>
                              _confirmDeleteChecklist(docId, checklist['title']),
                          onAddItem: () => _showAddItemDialog(docId),
                          onDeleteItem: (i) => _deleteItem(docId, i),
                          onToggleItem: (i) => _toggleItem(docId, i),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildPageHeader(BuildContext context) {
    final canSave = _hasUnsavedChanges;

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
              GestureDetector(
                onTap: canSave ? save : null,
                child: Container(
                  height: 40,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: canSave ? _green : _border,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  alignment: Alignment.center,
                  child: Text('Save', style: _bold(15)),
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

class ChecklistCard extends StatefulWidget {
  final String title;
  final String subtitle;
  final List<ChecklistItem> items;
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
  State<ChecklistCard> createState() => _ChecklistCardState();
}

class _ChecklistCardState extends State<ChecklistCard> {
  bool _showDeleteItems = false;

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
              Expanded(child: Text(widget.title, style: _regular(22))),
              if (widget.showDeleteIcon)
                GestureDetector(
                  onTap: widget.onDelete,
                  child: const Padding(
                    padding: EdgeInsets.only(left: 8),
                    child: Icon(Icons.close, size: 20, color: _placeholder),
                  ),
                ),
            ],
          ),

          const SizedBox(height: 2),
          Text(widget.subtitle, style: _regular(14, color: _placeholder)),

          if (widget.items.isNotEmpty) const SizedBox(height: 12),

          // Items
          for (var i = 0; i < widget.items.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: Checkbox(
                      value: widget.items[i].checked,
                      onChanged: (_) => widget.onToggleItem?.call(i),
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
                      widget.items[i].text,
                      style: _regular(
                        15,
                        color: widget.items[i].checked ? _placeholder : _dark,
                      ).copyWith(
                        decoration: widget.items[i].checked
                            ? TextDecoration.lineThrough
                            : null,
                      ),
                    ),
                  ),
                  if (_showDeleteItems)
                    GestureDetector(
                      onTap: () => widget.onDeleteItem?.call(i),
                      child: const Padding(
                        padding: EdgeInsets.only(left: 8),
                        child: Icon(Icons.delete_outline, size: 18, color: _placeholder),
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
                  onTap: widget.onAddItem,
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
                child: GestureDetector(
                  onTap: () => setState(() => _showDeleteItems = !_showDeleteItems), 
                  child: Container(
                    height: 40,
                    decoration: BoxDecoration(
                      color: _dark,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    alignment: Alignment.center,
                    child: Text('- Delete Items', style: _bold(15, color: Colors.white)),
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

// ─── Archive Page ──────────────────────────────────────────────────────────────

class ArchivePage extends StatelessWidget {
  final ChecklistService checklistService;

  const ArchivePage({super.key, required this.checklistService});

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
      body: StreamBuilder<List<Checklist>>(
        stream: checklistService.streamCurrentUserChecklists(
          archived: true,
        ),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final archivedLists = snapshot.data!;

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
              final checklist = archivedLists[index];

              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Container(
                  decoration: _cardDecoration,
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(checklist.title, style: _regular(22)),
                      const SizedBox(height: 2),
                      Text(checklist.subtitle,
                          style: _regular(14, color: _placeholder)),
                      const SizedBox(height: 14),
                      GestureDetector(
                        onTap: () => checklistService.duplicateChecklist(checklist),
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
