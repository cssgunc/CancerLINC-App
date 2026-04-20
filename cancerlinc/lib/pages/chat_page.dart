import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cancerlinc/services/chat_service.dart';

// ── Message group data class ───────────────────────────────────────────────────

class _MsgGroup {
  final String senderId;
  final bool isUser;
  final List<Map<String, dynamic>> messages;

  _MsgGroup({required this.senderId, required this.isUser, required this.messages});
}

// ── Page ──────────────────────────────────────────────────────────────────────

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final ChatService _chatService = ChatService();
  String? _chatId;
  String _workerName = 'Chat with CancerLINC';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadChat();
  }

  Future<void> _loadChat() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid != null) {
      final userDoc =
          await FirebaseFirestore.instance.collection('users').doc(uid).get();
      final name = userDoc.data()?['assignedSocialWorkerName'] as String?;
      if (name != null && name.isNotEmpty) _workerName = name;
    }
    final doc = await _chatService.getUserChat();
    if (mounted) {
      setState(() {
        _chatId = doc?.id;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          _ChatHeader(workerName: _workerName),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _chatId == null
                    ? const Center(
                        child: Text(
                          'Send a text to get started!',
                          style: TextStyle(color: Color(0xFF999999)),
                        ),
                      )
                    : _MessagesList(
                        chatId: _chatId!,
                        chatService: _chatService,
                        workerName: _workerName,
                      ),
          ),
          if (!_loading)
            _ChatInput(
              chatId: _chatId,
              chatService: _chatService,
              onChatCreated: (id) => setState(() => _chatId = id),
            ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _ChatHeader extends StatelessWidget {
  final String workerName;

  const _ChatHeader({required this.workerName});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFD9D9D9))),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFD9D9D9),
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              workerName,
              style: const TextStyle(fontSize: 14, color: Colors.black),
            ),
          ),
          _HeaderIconButton(icon: Icons.search),
          const SizedBox(width: 16),
          _HeaderIconButton(icon: Icons.phone),
        ],
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  final IconData icon;
  const _HeaderIconButton({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, color: Colors.white, size: 24),
    );
  }
}

// ── Messages list ─────────────────────────────────────────────────────────────

class _MessagesList extends StatefulWidget {
  final String chatId;
  final ChatService chatService;
  final String workerName;

  const _MessagesList({
    required this.chatId,
    required this.chatService,
    required this.workerName,
  });

  @override
  State<_MessagesList> createState() => _MessagesListState();
}

class _MessagesListState extends State<_MessagesList> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  List<_MsgGroup> _groupMessages(
      List<QueryDocumentSnapshot> docs, String currentUserId) {
    final groups = <_MsgGroup>[];
    for (final doc in docs) {
      final data = doc.data() as Map<String, dynamic>;
      final senderId = data['senderId'] as String? ?? '';
      final isUser = senderId == currentUserId;
      if (groups.isNotEmpty && groups.last.senderId == senderId) {
        groups.last.messages.add(data);
      } else {
        groups.add(
            _MsgGroup(senderId: senderId, isUser: isUser, messages: [data]));
      }
    }
    return groups;
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = FirebaseAuth.instance.currentUser!.uid;

    return StreamBuilder<QuerySnapshot>(
      stream: widget.chatService.streamMessages(widget.chatId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return const Center(
            child: Text(
              'No messages yet. Say hello!',
              style: TextStyle(color: Color(0xFF999999)),
            ),
          );
        }

        final docs = snapshot.data!.docs;
        final groups = _groupMessages(docs, currentUserId);
        _scrollToBottom();

        return ListView.separated(
          controller: _scrollController,
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
          itemCount: groups.length,
          separatorBuilder: (context, index) => const SizedBox(height: 16),
          itemBuilder: (context, index) {
            final group = groups[index];
            final lastMsg = group.messages.last;
            final timestamp = lastMsg['timestamp'] as Timestamp?;
            final time =
                timestamp != null ? _formatTime(timestamp.toDate()) : '';
            final senderName =
                group.isUser ? 'You' : widget.workerName;

            return _MessageGroupWidget(
              group: group,
              senderName: senderName,
              time: time,
            );
          },
        );
      },
    );
  }

  String _formatTime(DateTime dt) {
    final hour =
        dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final minute = dt.minute.toString().padLeft(2, '0');
    final period = dt.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }
}

// ── Message group widget ──────────────────────────────────────────────────────

class _MessageGroupWidget extends StatelessWidget {
  final _MsgGroup group;
  final String senderName;
  final String time;

  const _MessageGroupWidget({
    required this.group,
    required this.senderName,
    required this.time,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment:
          group.isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Text(
          senderName,
          style: const TextStyle(
            fontSize: 12,
            color: Color(0xFF999999),
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        for (int i = 0; i < group.messages.length; i++) ...[
          if (i > 0) const SizedBox(height: 2),
          _MessageBubble(
            text: group.messages[i]['content'] as String? ?? '',
            isUser: group.isUser,
            messageType: group.messages[i]['messageType'] as String? ?? 'text',
            imageUrl: group.messages[i]['imageUrl'] as String?,
          ),
        ],
        const SizedBox(height: 6),
        Text(
          time,
          style: const TextStyle(fontSize: 12, color: Color(0xFF999999)),
        ),
      ],
    );
  }
}

// ── Message bubble ────────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  final String text;
  final bool isUser;
  final String messageType;
  final String? imageUrl;

  const _MessageBubble({
    required this.text,
    required this.isUser,
    this.messageType = 'text',
    this.imageUrl,
  });

  @override
  Widget build(BuildContext context) {
    final isImage =
        messageType == 'image' && imageUrl != null && imageUrl!.isNotEmpty;

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 280),
        padding: isImage
            ? const EdgeInsets.all(4)
            : const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isUser ? Colors.black : const Color(0xFFF0F0F0),
          borderRadius: BorderRadius.circular(12),
        ),
        child: isImage
            ? GestureDetector(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    fullscreenDialog: true,
                    builder: (_) => _FullScreenImage(url: imageUrl!),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    imageUrl!,
                    fit: BoxFit.cover,
                    loadingBuilder: (context, child, progress) {
                      if (progress == null) return child;
                      return const SizedBox(
                        width: 200,
                        height: 150,
                        child: Center(child: CircularProgressIndicator()),
                      );
                    },
                    errorBuilder: (context, error, stack) => const SizedBox(
                      width: 200,
                      height: 150,
                      child: Center(
                        child: Icon(Icons.broken_image,
                            color: Colors.grey, size: 40),
                      ),
                    ),
                  ),
                ),
              )
            : Text(
                text,
                style: TextStyle(
                  fontSize: 16,
                  height: 1.5,
                  color: isUser ? Colors.white : Colors.black,
                ),
              ),
      ),
    );
  }
}

// ── Full-screen image viewer ──────────────────────────────────────────────────

class _FullScreenImage extends StatelessWidget {
  final String url;
  const _FullScreenImage({required this.url});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Center(
            child: InteractiveViewer(
              minScale: 0.5,
              maxScale: 4.0,
              child: Image.network(
                url,
                fit: BoxFit.contain,
                loadingBuilder: (context, child, progress) {
                  if (progress == null) return child;
                  return const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  );
                },
                errorBuilder: (context, error, stack) => const Center(
                  child: Icon(Icons.broken_image,
                      color: Colors.grey, size: 64),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: IconButton(
                  icon: const Icon(Icons.close,
                      color: Colors.white, size: 28),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Input bar ─────────────────────────────────────────────────────────────────

class _ChatInput extends StatefulWidget {
  final String? chatId;
  final ChatService chatService;
  final ValueChanged<String> onChatCreated;

  const _ChatInput({
    required this.chatId,
    required this.chatService,
    required this.onChatCreated,
  });

  @override
  State<_ChatInput> createState() => _ChatInputState();
}

class _ChatInputState extends State<_ChatInput> {
  final TextEditingController _controller = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);
    _controller.clear();

    try {
      String chatId = widget.chatId ??
          await widget.chatService.findOrCreateUserChat();
      if (widget.chatId == null) widget.onChatCreated(chatId);
      await widget.chatService.sendMessage(chatId, text);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to send: $e')),
        );
      }
    }

    if (mounted) setState(() => _sending = false);
  }

  Future<void> _pickAndSendImage() async {
    if (_sending) return;
    final picker = ImagePicker();
    final picked =
        await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;

    setState(() => _sending = true);

    try {
      String chatId = widget.chatId ??
          await widget.chatService.findOrCreateUserChat();
      if (widget.chatId == null) widget.onChatCreated(chatId);
      await widget.chatService
          .sendImageMessage(chatId, File(picked.path), picked.name);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to send image: $e')),
        );
      }
    }

    if (mounted) setState(() => _sending = false);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFD9D9D9))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 52,
              decoration: BoxDecoration(
                color: const Color(0xFFF0F0F0),
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _controller,
                onSubmitted: (_) => _send(),
                decoration: const InputDecoration(
                  hintText: 'Type or add image....',
                  hintStyle: TextStyle(
                    fontSize: 16,
                    fontStyle: FontStyle.italic,
                    color: Color(0xFF999999),
                  ),
                  border: InputBorder.none,
                ),
                style: const TextStyle(fontSize: 16, color: Colors.black),
              ),
            ),
          ),
          const SizedBox(width: 12),
          _InputButton(
            icon: Icons.add_photo_alternate,
            onTap: _sending ? null : _pickAndSendImage,
          ),
          const SizedBox(width: 12),
          _InputButton(
            icon: Icons.send,
            onTap: _sending ? null : _send,
          ),
        ],
      ),
    );
  }
}

class _InputButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _InputButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: onTap != null ? Colors.black : Colors.grey,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: Colors.white, size: 24),
      ),
    );
  }
}
