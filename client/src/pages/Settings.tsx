// src/pages/Settings.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  Alert,
  Snackbar
} from '@mui/material';

import { useTheme } from '../context/ThemeContext';

const Settings: React.FC = () => {
  const { mode, setMode } = useTheme();

  // API设置
  const [apiUrl, setApiUrl] = useState(process.env.REACT_APP_API_URL || '');
  const [wsUrl, setWsUrl] = useState(process.env.REACT_APP_WS_URL || '');

  // 界面设置
  const [messageDensity, setMessageDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [enableCodeHighlighting, setEnableCodeHighlighting] = useState(true);
  const [enableMarkdown, setEnableMarkdown] = useState(true);

  // 消息通知
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'info' | 'warning' | 'error'
  });

  // 加载保存的设置
  useEffect(() => {
    // 从 localStorage 加载设置
    const savedMessageDensity = localStorage.getItem('messageDensity');
    const savedCodeHighlighting = localStorage.getItem('enableCodeHighlighting');
    const savedMarkdown = localStorage.getItem('enableMarkdown');
    const savedApiUrl = localStorage.getItem('apiUrl');
    const savedWsUrl = localStorage.getItem('wsUrl');

    if (savedMessageDensity) {
      setMessageDensity(savedMessageDensity as 'comfortable' | 'compact');
    }

    if (savedCodeHighlighting !== null) {
      setEnableCodeHighlighting(savedCodeHighlighting === 'true');
    }

    if (savedMarkdown !== null) {
      setEnableMarkdown(savedMarkdown === 'true');
    }

    if (savedApiUrl) {
      setApiUrl(savedApiUrl);
    }

    if (savedWsUrl) {
      setWsUrl(savedWsUrl);
    }
  }, []);

  // 保存设置
  const handleSaveSettings = () => {
    // 实际项目中这里可能会持久化到 localStorage 或调用 API
    localStorage.setItem('apiUrl', apiUrl);
    localStorage.setItem('wsUrl', wsUrl);
    localStorage.setItem('messageDensity', messageDensity);
    localStorage.setItem('enableCodeHighlighting', String(enableCodeHighlighting));
    localStorage.setItem('enableMarkdown', String(enableMarkdown));

    setSnackbar({
      open: true,
      message: '设置已保存',
      severity: 'success'
    });
  };

  // 重置设置
  const handleResetSettings = () => {
    // 重置为默认值
    setApiUrl(process.env.REACT_APP_API_URL || '');
    setWsUrl(process.env.REACT_APP_WS_URL || '');
    setMessageDensity('comfortable');
    setEnableCodeHighlighting(true);
    setEnableMarkdown(true);

    // 清除本地存储
    localStorage.removeItem('apiUrl');
    localStorage.removeItem('wsUrl');
    localStorage.removeItem('messageDensity');
    localStorage.removeItem('enableCodeHighlighting');
    localStorage.removeItem('enableMarkdown');

    setSnackbar({
      open: true,
      message: '设置已重置为默认值',
      severity: 'info'
    });
  };

  // 关闭通知
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        设置
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          外观
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <FormControl fullWidth margin="normal">
          <InputLabel id="theme-mode-label">主题模式</InputLabel>
          <Select
            labelId="theme-mode-label"
            value={mode}
            label="主题模式"
            onChange={(e) => setMode(e.target.value as 'light' | 'dark' | 'system')}
          >
            <MenuItem value="light">亮色</MenuItem>
            <MenuItem value="dark">暗色</MenuItem>
            <MenuItem value="system">跟随系统</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel id="message-density-label">消息密度</InputLabel>
          <Select
            labelId="message-density-label"
            value={messageDensity}
            label="消息密度"
            onChange={(e) => setMessageDensity(e.target.value as 'comfortable' | 'compact')}
          >
            <MenuItem value="comfortable">舒适</MenuItem>
            <MenuItem value="compact">紧凑</MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={enableCodeHighlighting}
              onChange={(e) => setEnableCodeHighlighting(e.target.checked)}
            />
          }
          label="启用代码高亮"
          sx={{ mt: 2, display: 'block' }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={enableMarkdown}
              onChange={(e) => setEnableMarkdown(e.target.checked)}
            />
          }
          label="启用 Markdown 渲染"
          sx={{ mt: 1, display: 'block' }}
        />
      </Paper>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          API 设置
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Alert severity="info" sx={{ mb: 2 }}>
          修改这些设置可能会导致应用无法正常工作。请确保您知道自己在做什么。
        </Alert>

        <TextField
          fullWidth
          margin="normal"
          label="GraphQL API URL"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="https://your-worker.workers.dev/graphql"
          helperText="GraphQL API 的端点 URL"
        />

        <TextField
          fullWidth
          margin="normal"
          label="WebSocket URL"
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
          placeholder="wss://your-worker.workers.dev/graphql"
          helperText="用于 GraphQL 订阅的 WebSocket URL"
        />
      </Paper>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          关于
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <List>
          <ListItem>
            <ListItemText
              primary="应用版本"
              secondary="1.0.0"
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="GraphQL API"
              secondary={process.env.REACT_APP_API_URL || '未设置'}
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="环境"
              secondary={process.env.NODE_ENV}
            />
          </ListItem>
        </List>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          variant="outlined"
          color="warning"
          onClick={handleResetSettings}
        >
          重置为默认值
        </Button>

        <Button
          variant="contained"
          color="primary"
          onClick={handleSaveSettings}
        >
          保存设置
        </Button>
      </Box>

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
    </Box>
  );
};

export default Settings;