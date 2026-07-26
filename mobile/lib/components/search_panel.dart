import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:cancerlinc/services/chat_service.dart';

// ── Search panel ──────────────────────────────────────────────────────────────

class SearchPanel extends StatefulWidget {
  final String chatId;
  final ChatService chatService;
  final VoidCallback onClose;
  final ValueChanged<String> onSelectMessage;

  const SearchPanel({
    super.key,
    required this.chatId,
    required this.chatService,
    required this.onClose,
    required this.onSelectMessage,
  });

  @override
  State<SearchPanel> createState() => _SearchPanelState();
}

class _SearchPanelState extends State<SearchPanel> {
  final TextEditingController _controller = TextEditingController();
  String _query = '';

  // Cache the stream once instead of calling widget.chatService.streamMessages()
  // inside build(). Firestore's .snapshots() returns a NEW Stream object on
  // every call, and StreamBuilder treats a "new" stream identity as a reason
  // to tear down and recreate its subscription (briefly showing the loading
  // state). Requesting it fresh on every rebuild causes unnecessary
  // resubscribes/flicker; caching it keeps a single stable subscription.
  late Stream<QuerySnapshot> _messagesStream;

  @override
  void initState() {
    super.initState();
    _messagesStream = widget.chatService.streamMessages(widget.chatId);
  }

  @override
  void didUpdateWidget(covariant SearchPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.chatId != widget.chatId) {
      _messagesStream = widget.chatService.streamMessages(widget.chatId);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _formatTime(DateTime dt) {
    final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final minute = dt.minute.toString().padLeft(2, '0');
    final period = dt.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Material(
        color: Colors.white,
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: Color(0xFFD9D9D9))),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 44,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0F0F0),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.search,
                            color: Color(0xFF999999),
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: _controller,
                              autofocus: true,
                              onChanged: (v) =>
                                  setState(() => _query = v.trim()),
                              decoration: const InputDecoration(
                                hintText: 'Search messages...',
                                hintStyle: TextStyle(
                                  color: Color(0xFF999999),
                                  fontSize: 15,
                                ),
                                border: InputBorder.none,
                                isDense: true,
                              ),
                              style: const TextStyle(
                                fontSize: 15,
                                color: Colors.black,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  GestureDetector(
                    onTap: widget.onClose,
                    child: const Icon(
                      Icons.close,
                      size: 24,
                      color: Colors.black,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _query.isEmpty
                  ? const Center(
                      child: Text(
                        'Type a keyword to search messages',
                        style: TextStyle(color: Color(0xFF999999)),
                      ),
                    )
                  : StreamBuilder<QuerySnapshot>(
                      stream: _messagesStream,
                      builder: (context, snapshot) {
                        if (snapshot.connectionState ==
                            ConnectionState.waiting) {
                          return const Center(
                            child: CircularProgressIndicator(),
                          );
                        }

                        final docs = snapshot.data?.docs ?? [];
                        final queryLower = _query.toLowerCase();
                        final matches = docs.where((doc) {
                          final data = doc.data() as Map<String, dynamic>;
                          final content = (data['content'] as String? ?? '')
                              .toLowerCase();
                          return content.isNotEmpty &&
                              content.contains(queryLower);
                        }).toList();

                        if (matches.isEmpty) {
                          return const Center(
                            child: Text(
                              'No messages found',
                              style: TextStyle(color: Color(0xFF999999)),
                            ),
                          );
                        }

                        return ListView.separated(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          itemCount: matches.length,
                          separatorBuilder: (_, __) => const Divider(
                            height: 1,
                            color: Color(0xFFEFEFEF),
                          ),
                          itemBuilder: (context, index) {
                            final data =
                                matches[index].data() as Map<String, dynamic>;
                            final messageId =
                                data['messageId'] as String? ??
                                matches[index].id;
                            final senderName =
                                data['senderName'] as String? ?? '';
                            final content = data['content'] as String? ?? '';
                            final timestamp = data['timestamp'] as Timestamp?;
                            final time = timestamp != null
                                ? _formatTime(timestamp.toDate())
                                : '';

                            return ListTile(
                              onTap: () => widget.onSelectMessage(messageId),
                              title: Text(
                                senderName,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black,
                                ),
                              ),
                              subtitle: Text(
                                content,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: Color(0xFF444444),
                                ),
                              ),
                              trailing: Text(
                                time,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF999999),
                                ),
                              ),
                            );
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
