import 'dart:async';
import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';
import 'package:cancerlinc/services/chat_service.dart';
import 'package:cancerlinc/services/notification_service.dart';
import 'package:cancerlinc/components/call_number.dart';
import 'package:cancerlinc/components/search_panel.dart';
import 'package:cancerlinc/utils/haptics.dart';

/// FEATURE FLAG — show the Social Worker availability notice at the top of
/// the chat. Set to `false` to hide it; to remove the feature entirely delete
/// this const, the `_hoursBanner()` widget, and its use in `build()`.
///
/// This replaces the old M4 "pending verification" notice. That banner told
/// unverified patients they'd get increased priority once verified, which is
/// now unreachable copy: unverified patients are held at [AuthGate] and never
/// reach the chat at all.
const bool kShowSocialWorkerHoursNotice = true;

// ── Message group data class ───────────────────────────────────────────────────

class _MsgGroup {
  final String senderId;
  final bool isUser;
  final List<Map<String, dynamic>> messages;

  _MsgGroup({
    required this.senderId,
    required this.isUser,
    required this.messages,
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final ChatService _chatService = ChatService();
  final GlobalKey<_MessagesListState> _messagesListKey =
      GlobalKey<_MessagesListState>();
  String? _chatId;
  String _workerName = 'Chat with CancerLINC';
  bool _loading = true;
  bool _isBanned = false;
  bool _isVerified = false;
  bool _searchOpen = false;

  // Reset on every mount, which is exactly what we want: BottomBar rebuilds
  // ChatPage from scratch on each tab switch, so the notice reappears
  // expanded every time the user navigates back to the chat.
  bool _hoursNoticeCollapsed = false;

  @override
  void initState() {
    super.initState();
    _loadChat();
    // initial pop up for notification permission and setup
    _requestNotificationPermission();
  }

  // initializes notification service and requests permission to show notifications
  Future<void> _requestNotificationPermission() async {
    await NotificationService().requestPermissionAndInit(context);
  }

  Future<void> _loadChat() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid != null) {
      final userDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .get();
      final data = userDoc.data();
      final name = data?['assignedSocialWorkerName'] as String?;
      if (name != null && name.isNotEmpty) _workerName = "Your contact: $name";
      _isBanned = data?['isBanned'] == true;
      _isVerified = data?['isVerified'] == true;
    }
    final doc = await _chatService.getUserChat();
    if (mounted) {
      setState(() {
        _chatId = doc?.id;
        _loading = false;
      });
    }
  }

  void _toggleSearch() {
    setState(() => _searchOpen = !_searchOpen);
  }

  /// Called when a search result is tapped: closes the search panel and
  /// scrolls the message list to that message.
  void _onSearchResultSelected(String messageId) {
    setState(() => _searchOpen = false);
    // Wait a frame so the search panel is gone and the message list is
    // back in the widget tree before we try to scroll it.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _messagesListKey.currentState?.scrollToMessage(messageId);
    });
  }

  /// Returns a centered notice with [message] text and a tappable support number.
  Widget _blockedNotice(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF999999)),
            ),
            const SizedBox(height: 12),
            CallButton(phoneNumber: cancerLincSupportPhone),
          ],
        ),
      ),
    );
  }

  /// Non-blocking notice telling patients when the Social Worker team is
  /// reachable, so an after-hours message doesn't read as being ignored.
  /// Patients can still send messages at any time.
  ///
  /// Collapses to a thin strip rather than disappearing: the hours stay one
  /// tap away for the rest of the visit instead of being gone until the next
  /// time the chat tab is rebuilt. Tapping anywhere on it toggles, in either
  /// state, as does a vertical swipe.
  ///
  /// AnimatedSize animates between the two heights, matching the 220ms easeOut
  /// used elsewhere in the app. A plain GestureDetector is enough for the
  /// swipe — Dismissible wants a fixed-extent child in a list and brings its
  /// own horizontal-swipe defaults we'd only have to switch off.
  void _setHoursNoticeCollapsed(bool collapsed) {
    if (_hoursNoticeCollapsed == collapsed) return;
    AppHaptics.tap();
    setState(() => _hoursNoticeCollapsed = collapsed);
  }

  Widget _hoursBanner() {
    return AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
      alignment: Alignment.topCenter,
      child: Semantics(
        button: true,
        label: _hoursNoticeCollapsed
            ? 'Show social worker hours'
            : 'Hide social worker hours',
        child: GestureDetector(
          onVerticalDragEnd: (details) {
            final velocity = details.primaryVelocity ?? 0;
            // Direction-matched: a fling up tucks it away, a fling down pulls
            // it back out. A drag that goes nowhere leaves the state alone.
            if (velocity < 0) {
              _setHoursNoticeCollapsed(true);
            } else if (velocity > 0) {
              _setHoursNoticeCollapsed(false);
            }
          },
          // The whole banner toggles in both states — the chevron is the
          // affordance, not the only tap target.
          child: InkWell(
            onTap: () => _setHoursNoticeCollapsed(!_hoursNoticeCollapsed),
            child: _hoursNoticeCollapsed
                ? _collapsedHoursBanner()
                : _expandedHoursBanner(),
          ),
        ),
      ),
    );
  }

  /// The tucked-away state: a bare strip of the notice's colour with just the
  /// chevron on it, keeping the reopen affordance visible without spending any
  /// vertical space on copy. The chevron sits at the right edge, on the same
  /// 16px inset as the expanded banner's, so it doesn't move sideways as the
  /// banner opens and closes.
  Widget _collapsedHoursBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      color: const Color(0xFFFFF8E1),
      alignment: Alignment.centerRight,
      child: const Icon(
        Icons.keyboard_arrow_down,
        size: 16,
        color: Color(0xFF8D6E63),
      ),
    );
  }

  Widget _expandedHoursBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: const Color(0xFFFFF8E1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.schedule, size: 20, color: Color(0xFF8D6E63)),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              '$socialWorkerHours Messages sent outside those hours will '
              'be answered the next working day. If this is urgent, call using the button above.',
              style: TextStyle(fontSize: 13, color: Color(0xFF5D4037)),
            ),
          ),
          const SizedBox(width: 8),
          // Affordance only — the tap is handled by the banner-wide InkWell,
          // so this stays a plain Icon rather than a nested button that would
          // swallow taps in one corner and report itself separately to
          // screen readers.
          const Icon(
            Icons.keyboard_arrow_up,
            size: 20,
            color: Color(0xFF8D6E63),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Determine whether the user is blocked and which copy to show.
    // Evaluated only once loading completes; null means not blocked.
    String? blockedMessage;
    if (!_loading) {
      if (_isBanned && _isVerified) {
        // M3: banned user who was previously verified.
        blockedMessage =
            'Your chat access has been removed. If you think this is a mistake, contact CancerLINC at';
      } else if (_isBanned) {
        // M3: banned user who was never verified.
        blockedMessage =
            "We couldn't verify your account, so chat isn't available. "
            "If you're a CancerLINC client, please reach out at";
      }
    }
    final blocked = blockedMessage != null;

    // Availability notice for everyone who can actually use the chat.
    final showHoursNotice =
        !_loading && !blocked && kShowSocialWorkerHoursNotice;

    final canSearch = !_loading && !blocked && _chatId != null;
    // If the state we're searchable in disappears (chat blocked, unloaded),
    // make sure the panel doesn't stay stuck open.
    if (!canSearch && _searchOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _searchOpen = false);
      });
    }

    return SafeArea(
      child: Column(
        children: [
          _ChatHeader(
            workerName: _workerName,
            searchActive: _searchOpen,
            searchEnabled: canSearch,
            onSearchTap: _toggleSearch,
          ),
          if (showHoursNotice) _hoursBanner(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : blocked
                ? _blockedNotice(blockedMessage)
                : _chatId == null
                ? const Center(
                    child: Text(
                      'Send a text to get started!',
                      style: TextStyle(color: Color(0xFF999999)),
                    ),
                  )
                : Stack(
                    children: [
                      _MessagesList(
                        key: _messagesListKey,
                        chatId: _chatId!,
                        chatService: _chatService,
                      ),
                      if (_searchOpen)
                        SearchPanel(
                          chatId: _chatId!,
                          chatService: _chatService,
                          onClose: () => setState(() => _searchOpen = false),
                          onSelectMessage: _onSearchResultSelected,
                        ),
                    ],
                  ),
          ),
          if (!_loading && !blocked && !_searchOpen)
            _ChatInput(
              chatId: _chatId,
              chatService: _chatService,
              onChatCreated: (id) => setState(() => _chatId = id),
              isBanned: _isBanned,
            ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _ChatHeader extends StatelessWidget {
  final String workerName;
  final bool searchActive;
  final bool searchEnabled;
  final VoidCallback? onSearchTap;

  const _ChatHeader({
    required this.workerName,
    this.searchActive = false,
    this.searchEnabled = false,
    this.onSearchTap,
  });

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
          _HeaderIconButton(
            icon: Icons.search,
            active: searchActive,
            onTap: searchEnabled ? onSearchTap : null,
          ),
          const SizedBox(width: 16),
          _HeaderIconButton(icon: Icons.phone),
        ],
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  final IconData icon;
  final bool active;
  final VoidCallback? onTap;

  const _HeaderIconButton({
    required this.icon,
    this.active = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: active ? const Color(0xFF444444) : Colors.black,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: Colors.white, size: 24),
      ),
    );
  }
}


// ── Messages list ─────────────────────────────────────────────────────────────

class _MessagesList extends StatefulWidget {
  final String chatId;
  final ChatService chatService;

  const _MessagesList({
    super.key,
    required this.chatId,
    required this.chatService,
  });

  @override
  State<_MessagesList> createState() => _MessagesListState();
}

class _MessagesListState extends State<_MessagesList> {
  // ScrollablePositionedList lets us jump straight to any index without
  // needing every item in between to be built first (unlike a plain
  // ScrollController + ListView, which only lays out items near the
  // viewport). This is what makes scrollToMessage work reliably and stay
  // fast even with a very large number of messages.
  final ItemScrollController _itemScrollController = ItemScrollController();
  final ItemPositionsListener _itemPositionsListener =
      ItemPositionsListener.create();

  // Cache the stream once instead of calling widget.chatService.streamMessages()
  // inside build(). Firestore's .snapshots() returns a NEW Stream object on
  // every call. StreamBuilder identifies its subscription by stream identity,
  // so requesting a "new" stream on every rebuild (e.g. every time we
  // setState() to toggle the search-result highlight) makes it tear down and
  // recreate the subscription. That briefly swaps ScrollablePositionedList
  // out for the ConnectionState.waiting loading spinner, which destroys its
  // scroll-position state — and when the list comes back it defaults to the
  // top. That's what was causing the "jumps back to the top after scrolling
  // to a searched message" bug. Caching the stream keeps one stable
  // subscription across rebuilds, so scroll position is only ever changed by
  // scrollToMessage()/_scrollToBottom(), never as a side effect of rebuilding.
  late Stream<QuerySnapshot> _messagesStream;

  // Chronological index (within the current groups list) of the group
  // containing a given messageId, so scrollToMessage knows exactly where to
  // jump. The list renders reversed, so this is mirrored against
  // _lastGroupCount before it's handed to the scroll controller.
  final Map<String, int> _messageGroupIndex = {};
  int _lastGroupCount = 0;

  String? _highlightedMessageId;
  Timer? _highlightTimer;
  int _lastDocCount = 0;

  // BottomBar rebuilds ChatPage from scratch on every tab switch, so the very
  // first snapshot always has to move the list from the top to the newest
  // message. Animating that is what read as a wild scroll through the whole
  // conversation; the initial placement is now instant and only genuinely new
  // messages animate.
  bool _didInitialScroll = false;

  @override
  void initState() {
    super.initState();
    _messagesStream = widget.chatService.streamMessages(widget.chatId);
  }

  @override
  void didUpdateWidget(covariant _MessagesList oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.chatId != widget.chatId) {
      // Only grab a fresh stream when we're actually pointed at a different
      // chat document - not on every incidental rebuild.
      _messagesStream = widget.chatService.streamMessages(widget.chatId);
      _lastDocCount = 0;
      _didInitialScroll = false;
    }
  }

  @override
  void dispose() {
    _highlightTimer?.cancel();
    super.dispose();
  }

  /// The list is reversed, so the newest group is view index 0 and the
  /// bottom of the conversation is scroll offset 0 — a reversed list already
  /// sticks there as messages arrive. This only has to do anything when the
  /// user has scrolled up, and then it's a short hop rather than a jump
  /// across the whole conversation.
  void _scrollToBottom(int groupCount, {bool animate = true}) {
    if (groupCount == 0) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_itemScrollController.isAttached) return;
      if (_isAtBottom()) return;
      // scrollTo() asserts on a zero duration, so the un-animated landing
      // on a chat has to go through jumpTo().
      if (animate) {
        _itemScrollController.scrollTo(
          index: 0,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      } else {
        _itemScrollController.jumpTo(index: 0);
      }
    });
  }

  /// True when the newest group is already fully on screen, which is the
  /// common case right after sending: the reversed list kept us pinned to the
  /// bottom and there is nothing to animate.
  bool _isAtBottom() {
    final positions = _itemPositionsListener.itemPositions.value;
    if (positions.isEmpty) return false;
    for (final position in positions) {
      if (position.index == 0) return position.itemLeadingEdge >= -0.001;
    }
    return false;
  }

  /// Scrolls the list so the message with [messageId] is visible, and
  /// briefly highlights it so it's easy to spot. Works in O(1) regardless
  /// of how many messages are in the chat or how far away this one is.
  void scrollToMessage(String messageId) {
    final groupIndex = _messageGroupIndex[messageId];
    if (groupIndex == null) return;
    final targetIndex = _lastGroupCount - 1 - groupIndex;

    setState(() => _highlightedMessageId = messageId);
    _highlightTimer?.cancel();
    _highlightTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) setState(() => _highlightedMessageId = null);
    });

    void doScroll() {
      if (_itemScrollController.isAttached) {
        _itemScrollController.scrollTo(
          index: targetIndex,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeInOut,
          // Alignment is measured along the scroll axis, which the reversed
          // list runs bottom-to-top: 0.0 lands the target at the bottom of
          // the viewport, 1.0 at the top. 0.3 leaves it low on the screen so
          // the preceding messages stay visible above it.
          alignment: 0.3,
        );
      } else if (mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) => doScroll());
      }
    }

    WidgetsBinding.instance.addPostFrameCallback((_) => doScroll());
  }

  List<_MsgGroup> _groupMessages(
    List<QueryDocumentSnapshot> docs,
    String currentUserId,
  ) {
    final groups = <_MsgGroup>[];
    _messageGroupIndex.clear();
    for (final doc in docs) {
      final data = doc.data() as Map<String, dynamic>;
      final senderId = data['senderId'] as String? ?? '';
      final messageId = data['messageId'] as String? ?? doc.id;
      final isUser = senderId == currentUserId;
      if (groups.isNotEmpty && groups.last.senderId == senderId) {
        groups.last.messages.add(data);
      } else {
        groups.add(
          _MsgGroup(senderId: senderId, isUser: isUser, messages: [data]),
        );
      }
      _messageGroupIndex[messageId] = groups.length - 1;
    }
    return groups;
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = FirebaseAuth.instance.currentUser!.uid;

    return StreamBuilder<QuerySnapshot>(
      stream: _messagesStream,
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
        _lastGroupCount = groups.length;

        // Only react when new messages actually arrive, not on every rebuild.
        // Flipping isRead below changes document contents but not the count,
        // so the receipt write cannot re-trigger itself.
        if (docs.length != _lastDocCount) {
          _lastDocCount = docs.length;

          // Reading the chat is what clears the home screen's unread badge.
          // Best-effort and deliberately not awaited: the list should render
          // immediately regardless of whether the receipt write lands.
          unawaited(widget.chatService.markMessagesRead(docs));

          // Don't yank the list to the bottom while we're mid-way through
          // jumping to a searched message.
          if (_highlightedMessageId == null) {
            _scrollToBottom(groups.length, animate: _didInitialScroll);
            _didInitialScroll = true;
          }
        }

        // Reversed so the newest message is the resting position: a reversed
        // list stays pinned to the bottom as messages arrive, instead of
        // needing a scroll that would fling the newest group up to the top of
        // the viewport. View index 0 is the newest group.
        return ScrollablePositionedList.separated(
          reverse: true,
          itemScrollController: _itemScrollController,
          itemPositionsListener: _itemPositionsListener,
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
          itemCount: groups.length,
          separatorBuilder: (context, index) => const SizedBox(height: 16),
          itemBuilder: (context, index) {
            final group = groups[groups.length - 1 - index];
            final lastMsg = group.messages.last;
            final timestamp = lastMsg['timestamp'] as Timestamp?;
            final time = timestamp != null
                ? _formatTime(timestamp.toDate())
                : '';
            final senderName =
                group.messages.first['senderName'] as String? ?? '';

            return _MessageGroupWidget(
              group: group,
              senderName: senderName,
              time: time,
              highlightedMessageId: _highlightedMessageId,
            );
          },
        );
      },
    );
  }

  String _formatTime(DateTime dt) {
    final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
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
  final String? highlightedMessageId;

  const _MessageGroupWidget({
    required this.group,
    required this.senderName,
    required this.time,
    this.highlightedMessageId,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: group.isUser
          ? CrossAxisAlignment.end
          : CrossAxisAlignment.start,
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
          Builder(
            builder: (context) {
              final msg = group.messages[i];
              final messageId = msg['messageId'] as String? ?? '';
              final isHighlighted =
                  messageId.isNotEmpty && messageId == highlightedMessageId;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: isHighlighted
                      ? const Color(0x33FFD54F)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: _MessageBubble(
                  text: msg['content'] as String? ?? '',
                  isUser: group.isUser,
                  messageType: msg['messageType'] as String? ?? 'text',
                  imageUrl: msg['imageUrl'] as String?,
                ),
              );
            },
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
                        child: Icon(
                          Icons.broken_image,
                          color: Colors.grey,
                          size: 40,
                        ),
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
                  child: Icon(Icons.broken_image, color: Colors.grey, size: 64),
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
                  icon: const Icon(Icons.close, color: Colors.white, size: 28),
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
  final bool isBanned;

  const _ChatInput({
    required this.chatId,
    required this.chatService,
    required this.onChatCreated,
    required this.isBanned,
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
    if (widget.isBanned) return; // M3
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);

    try {
      String chatId =
          widget.chatId ?? await widget.chatService.findOrCreateUserChat();
      if (widget.chatId == null) widget.onChatCreated(chatId);
      await widget.chatService.sendMessage(chatId, text);
      // Only clear once the message is actually in Firestore. sendChatMessage
      // is a callable that returns after its batch commits, so awaiting it is
      // the right line to draw. Clearing up front used to lose whatever the
      // patient typed whenever the send failed.
      _controller.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to send: $e')));
      }
    }

    if (mounted) setState(() => _sending = false);
  }

  Future<void> _pickAndSendImage() async {
    if (widget.isBanned) return; // M3
    if (_sending) return;
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );
    if (picked == null) return;

    setState(() => _sending = true);

    try {
      String chatId =
          widget.chatId ?? await widget.chatService.findOrCreateUserChat();
      if (widget.chatId == null) widget.onChatCreated(chatId);
      await widget.chatService.sendImageMessage(
        chatId,
        File(picked.path),
        picked.name,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to send image: $e')));
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
            loading: _sending,
          ),
        ],
      ),
    );
  }
}

class _InputButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  /// Swaps the icon for a spinner while the message is in flight, so the wait
  /// between tapping send and the bubble appearing reads as progress.
  final bool loading;

  const _InputButton({
    required this.icon,
    required this.onTap,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap == null
          ? null
          : () {
              AppHaptics.tap();
              onTap!();
            },
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: onTap != null ? Colors.black : Colors.grey,
          borderRadius: BorderRadius.circular(12),
        ),
        child: loading
            ? const Center(
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                ),
              )
            : Icon(icon, color: Colors.white, size: 24),
      ),
    );
  }
}
