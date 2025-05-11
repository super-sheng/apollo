import React, { useState } from 'react';
import { ApolloProvider } from '@apollo/client';
import {
  BrowserRouter as Router, Routes, Route, Navigate, Link as RouterLink
} from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import client from './graphql/client';

import {
  CssBaseline,
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme as useMuiTheme,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';

// Material UI 图标
import {
  Menu as MenuIcon,
  Chat as ChatIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';

// 自定义 hooks
import { useChat } from './hook/useChat';
import { useTheme } from './context/ThemeContext';

// 页面组件
import ChatPage from './pages/Chat';
import SettingsPage from './pages/Settings';

// 抽屉宽度
const drawerWidth = 280;

const App: React.FC = () => {
  // 使用 Material UI 主题来获取断点信息
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  // 使用自定义主题
  const { mode, toggleColorMode } = useTheme();

  // 侧边栏状态
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);

  // 通知状态
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // 使用聊天 hook
  const {
    conversations,
    selectedConversationId,
    messages,
    isLoadingConversations,
    createNewConversation,
    selectConversation,
    sendMessage,
    systemPrompt,
    setSystemPrompt
  } = useChat();

  // 处理抽屉开关
  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  // 处理添加新对话
  const handleNewConversation = async () => {
    try {
      const newConversation = await createNewConversation('新对话');
      if (newConversation) {
        setSnackbar({
          open: true,
          message: '成功创建新对话',
          severity: 'success'
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: '创建对话失败',
        severity: 'error'
      });
    }
  };

  // 关闭通知
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // 应用侧边栏内容
  const drawer = (
    <div>
      <Toolbar sx={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: theme => theme.spacing(0, 1)
      }}>
        <Typography variant="h6" noWrap component="div">
          GraphQL Chat
        </Typography>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <IconButton
          color="primary"
          onClick={handleNewConversation}
          aria-label="新建对话"
        >
          <AddIcon />
          <Typography variant="body2" sx={{ ml: 1 }}>
            新建对话
          </Typography>
        </IconButton>
      </Box>
      <List sx={{ mt: 2 }}>
        {isLoadingConversations ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          conversations.map((conversation) => (
            <ListItem
              key={conversation.id}
              disablePadding
              selected={selectedConversationId === conversation.id}
            >
              <ListItemButton
                onClick={() => selectConversation(conversation.id)}
              >
                <ListItemIcon>
                  <ChatIcon />
                </ListItemIcon>
                <ListItemText
                  primary={conversation.title}
                  secondary={new Date(conversation.updatedAt).toLocaleString()}
                />
              </ListItemButton>
            </ListItem>
          ))
        )}
      </List>
      <Divider sx={{ mt: 2 }} />
      <List>
        <ListItem disablePadding>
          <ListItemButton component={RouterLink} to="/settings">
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="设置" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={toggleColorMode}>
            <ListItemIcon>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </ListItemIcon>
            <ListItemText primary={mode === 'dark' ? '切换到亮色模式' : '切换到暗色模式'} />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  return (
    <ApolloProvider client={client}>
      <ThemeProvider>
        <Router>
          <Box sx={{ display: 'flex', height: '100vh' }}>
            <CssBaseline />
            <AppBar
              position="fixed"
              sx={{
                width: { md: drawerOpen ? `calc(100% - ${drawerWidth}px)` : '100%' },
                ml: { md: drawerOpen ? `${drawerWidth}px` : 0 },
                zIndex: theme => theme.zIndex.drawer + 1,
              }}
            >
              <Toolbar>
                <IconButton
                  color="inherit"
                  aria-label="open drawer"
                  edge="start"
                  onClick={handleDrawerToggle}
                  sx={{ mr: 2, display: { md: 'none' } }}
                >
                  <MenuIcon />
                </IconButton>
                <Typography variant="h6" noWrap component="div">
                  {selectedConversationId
                    ? conversations.find(c => c.id === selectedConversationId)?.title || 'GraphQL Chat'
                    : 'GraphQL Chat'
                  }
                </Typography>
              </Toolbar>
            </AppBar>

            {/* 移动端抽屉 */}
            <Drawer
              variant="temporary"
              open={isMobile && drawerOpen}
              onClose={handleDrawerToggle}
              ModalProps={{
                keepMounted: true, // 提升移动设备性能
              }}
              sx={{
                display: { xs: 'block', md: 'none' },
                '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
              }}
            >
              {drawer}
            </Drawer>

            {/* 永久抽屉 */}
            <Drawer
              variant="persistent"
              open={!isMobile && drawerOpen}
              sx={{
                display: { xs: 'none', md: 'block' },
                '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                width: drawerOpen ? drawerWidth : 0,
              }}
            >
              {drawer}
            </Drawer>

            {/* 主内容区域 */}
            <Box
              component="main"
              sx={{
                flexGrow: 1,
                p: 0,
                width: { md: `calc(100% - ${drawerOpen ? drawerWidth : 0}px)` },
                height: '100vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Toolbar /> {/* 为了AppBar留出空间 */}
              <Routes>
                <Route path="/chat/:conversationId" element={
                  <ChatPage
                    messages={messages}
                    sendMessage={sendMessage}
                    systemPrompt={systemPrompt}
                    setSystemPrompt={setSystemPrompt}
                  />
                } />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/" element={
                  selectedConversationId ?
                    <Navigate to={`/chat/${selectedConversationId}`} replace /> :
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        padding: 3,
                        textAlign: 'center'
                      }}
                    >
                      <Typography variant="h4" gutterBottom>
                        欢迎使用 GraphQL Chat
                      </Typography>
                      <Typography variant="body1" paragraph>
                        这是一个基于 GraphQL 和 OpenAI 的聊天应用。
                      </Typography>
                      <Typography variant="body1" paragraph>
                        点击侧边栏中的 "新建对话" 按钮开始聊天吧！
                      </Typography>
                    </Box>
                } />
              </Routes>
            </Box>
          </Box>

          {/* 通知 */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert
              onClose={handleCloseSnackbar}
              severity={snackbar.severity}
              sx={{ width: '100%' }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Router>
      </ThemeProvider>
    </ApolloProvider>
  );
};

export default App;