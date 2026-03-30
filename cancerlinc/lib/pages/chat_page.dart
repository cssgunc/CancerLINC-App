import 'package:flutter/material.dart';

class ChatPage extends StatelessWidget {
  const ChatPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          _ChatHeader(),
          Expanded(child: _MessagesList()),
          _ChatInput(),
        ],
      ),
    );
  }
}

class _ChatHeader extends StatelessWidget {
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
          const Expanded(
            child: Text(
              'John Doe, LCSW',
              style: TextStyle(fontSize: 14, color: Colors.black),
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

class _Message {
  final String text;
  final String time;
  final bool isUser;
  const _Message({required this.text, required this.time, required this.isUser});
}

class _MessagesList extends StatelessWidget {
  static const List<_Message> _messages = [
    _Message(
      text: "Hello! Of course, I'm here to help. What would you like to know?",
      time: '10:25 AM',
      isUser: false,
    ),
    _Message(
      text: 'Should I bring anything specific to my appointment next week?',
      time: '10:26 AM',
      isUser: true,
    ),
    _Message(
      text: "Great question! Let me check your checklist. You'll want to bring your insurance card, photo ID, and current medication list.",
      time: '10:28 AM',
      isUser: false,
    ),
    _Message(
      text: "Thank you! That's very helpful.",
      time: '10:29 AM',
      isUser: true,
    ),
    _Message(
      text: "You're welcome! Feel free to reach out if you have any other questions.",
      time: '10:30 AM',
      isUser: false,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      itemCount: _messages.length,
      separatorBuilder: (_, _) => const SizedBox(height: 16),
      itemBuilder: (context, index) => _MessageBubble(message: _messages[index]),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final _Message message;
  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    return Column(
      crossAxisAlignment:
          isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Container(
          constraints: const BoxConstraints(maxWidth: 280),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          decoration: BoxDecoration(
            color: isUser ? Colors.black : const Color(0xFFF0F0F0),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            message.text,
            style: TextStyle(
              fontSize: 16,
              height: 1.5,
              color: isUser ? Colors.white : Colors.black,
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          message.time,
          style: const TextStyle(fontSize: 14, color: Color(0xFF999999)),
        ),
      ],
    );
  }
}

class _ChatInput extends StatefulWidget {
  @override
  State<_ChatInput> createState() => _ChatInputState();
}

class _ChatInputState extends State<_ChatInput> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
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
          _InputButton(icon: Icons.add_photo_alternate),
          const SizedBox(width: 12),
          _InputButton(icon: Icons.send),
        ],
      ),
    );
  }
}

class _InputButton extends StatelessWidget {
  final IconData icon;
  const _InputButton({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(icon, color: Colors.white, size: 24),
    );
  }
}
