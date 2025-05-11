// src/pages/Chat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Material UI 组件
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Avatar,
  IconButton,
  CircularProgress,
  Divider,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material';

// Material UI 图标
import {
  Send as SendIcon,
  Settings as SettingsIcon,
  Stop as StopIcon,
  AutoAwesome as AiIcon,
  Person as PersonIcon
} from '@mui/icons-material';

// 类型
import { MessageWithStatus } from '../types/api';

interface ChatPageProps {
  messages: MessageWithStatus[];
  sendMessage: (text: string) => Promise<void>;
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
}

const ChatPage: React.FC<ChatPageProps> = ({
  messages,
  sendMessage,
  systemPrompt,
  setSystemPrompt
}) => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempSystemPrompt, setTempSystemPrompt] = useState(systemPrompt);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const theme = useTheme();

  // 当消息变化时滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 聚焦输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [conversationId]);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await sendMessage(inputValue);
      setInputValue('');
    } catch (error) {
      console.error('发送消息错误:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理系统提示更新
  const handleUpdateSystemPrompt = () => {
    setSystemPrompt(tempSystemPrompt);
    setSettingsOpen(false);
  };

  // 消息组件
  const renderMessage = (message: MessageWithStatus) => {
    const isUser = message.role === 'user';

    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          mb: 2,
          px: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            maxWidth: '70%',
            alignItems: 'flex-start',
            flexDirection: isUser ? 'row-reverse' : 'row',
          }}
        >
          <Avatar
            sx={{
              bgcolor: isUser ? theme.palette.primary.main : theme.palette.secondary.main,
              ml: isUser ? 1 : 0,
              mr: isUser ? 0 : 1
            }}
          >
            {isUser ? <PersonIcon /> : <AiIcon />}
          </Avatar>
          <Paper
            elevation={1}
            sx={{
              p: 2,
              bgcolor: isUser
                ? theme.palette.primary.light
                : theme.palette.mode === 'dark'
                  ? theme.palette.grey[800]
                  : theme.palette.grey[100],
              borderRadius: 2,
              position: 'relative',
            }}
          >
            <Typography
              variant="body1"
              component="div"
              sx={{
                wordBreak: 'break-word',
                '& pre': { margin: 0 },
                '& p': { margin: 0, mb: 1 },
                '& p:last-child': { mb: 0 },
                '& a': { color: theme.palette.primary.main },
                '& ul, & ol': { pl: 2, mb: 1 },
                '& h1, & h2, & h3, & h4, & h5, & h6': { mt: 1, mb: 1 },
              }}
            >
              {isUser ? (
                message.text
              ) : (
                <ReactMarkdown
                  components={{
                    // @ts-ignore
                    code ({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          // @ts-ignore
                          style={dracula}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              )}
            </Typography>
            <Typography
              variant="caption"
              color="textSecondary"
              sx={{
                display: 'block',
                mt: 1,
                textAlign: isUser ? 'right' : 'left',
              }}
            >
              {new Date(message.createdAt).toLocaleTimeString()}
            </Typography>
            {message.isStreaming && (
              <CircularProgress
                size={12}
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  left: isUser ? 'auto' : 8,
                  right: isUser ? 8 : 'auto'
                }}
              />
            )}
          </Paper>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* 消息列表 */}
      <Box sx={{
        flexGrow: 1,
        overflow: 'auto',
        py: 2,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {messages.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 3,
              textAlign: 'center'
            }}
          >
            <AiIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              开始一个新对话
            </Typography>
            <Typography variant="body1" color="textSecondary">
              发送一条消息开始与 AI 助手对话。
            </Typography>
          </Box>
        ) : (
          messages.map(message => renderMessage(message))
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* 输入区域 */}
      <Paper
        elevation={3}
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          m: 2,
          borderRadius: 2,
        }}
      >
        <Tooltip title="AI 设置">
          <IconButton sx={{ p: '10px' }} onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>

        <TextField
          fullWidth
          placeholder="输入消息..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          multiline
          maxRows={4}
          variant="standard"
          InputProps={{
            disableUnderline: true,
          }}
          inputRef={inputRef}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          sx={{ ml: 1, flex: 1 }}
        />

        <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />

        <IconButton
          color="primary"
          sx={{ p: '10px' }}
          type="submit"
          disabled={!inputValue.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <CircularProgress size={24} />
          ) : (
            <SendIcon />
          )}
        </IconButton>
      </Paper>

      {/* 系统提示设置对话框 */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <DialogTitle>AI 助手设置</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="system-prompt"
            label="系统提示词"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={tempSystemPrompt}
            onChange={(e) => setTempSystemPrompt(e.target.value)}
            helperText="系统提示词用于设置 AI 助手的行为和知识范围"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>取消</Button>
          <Button onClick={handleUpdateSystemPrompt}>确认</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatPage;