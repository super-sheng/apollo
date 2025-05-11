import React, {
  createContext,
  useContext, useState, useEffect, ReactNode
} from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// 自定义主题类型
export type ThemeMode = 'light' | 'dark' | 'system';

// 主题上下文类型
interface ThemeContextType {
  mode: ThemeMode;
  setMode?: (mode: ThemeMode) => void;
  toggleColorMode?: () => void;
  theme: Theme;
}

// 创建主题上下文
const ThemeContext = createContext<ThemeContextType | undefined>({
  mode: 'light',
} as ThemeContextType);

// 自定义hook，用于访问主题上下文
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  console.log('context: ', context);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// 创建主题
const createAppTheme = (mode: 'light' | 'dark'): Theme => {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#90caf9' : '#1976d2',
      },
      secondary: {
        main: mode === 'dark' ? '#f48fb1' : '#dc004e',
      },
      background: {
        default: mode === 'dark' ? '#121212' : '#f5f5f5',
        paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: mode === 'dark' ? '#1e1e1e' : '#f1f1f1',
            },
            '&::-webkit-scrollbar-thumb': {
              background: mode === 'dark' ? '#888' : '#c1c1c1',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: mode === 'dark' ? '#555' : '#a8a8a8',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: mode === 'dark'
              ? '0 2px 8px 0 rgba(0, 0, 0, 0.5)'
              : '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
    },
    shape: {
      borderRadius: 10,
    },
  });
};

// 从系统获取偏好色彩模式
const getSystemTheme = (): 'light' | 'dark' => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// 主题提供者组件
interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 尝试从本地存储获取主题模式，默认为"system"
  const storedMode = localStorage.getItem('themeMode') as ThemeMode;
  const [mode, setMode] = useState<ThemeMode>(storedMode || 'system');

  // 根据模式确定实际的主题类型
  const actualThemeMode = mode === 'system' ? getSystemTheme() : mode;
  const theme = createAppTheme(actualThemeMode);

  // 监听系统主题变化
  useEffect(() => {
    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      // 系统主题变化时，更新组件状态
      const handleChange = () => {
        // 强制重新渲染
        setMode(prev => {
          if (prev === 'system') {
            // 触发重新渲染的一种技巧
            const temp = prev as string;
            return temp as ThemeMode;
          }
          return prev;
        });
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [mode]);

  // 保存主题模式到本地存储
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  // 切换主题模式
  const toggleColorMode = () => {
    setMode(prevMode => {
      if (prevMode === 'light') return 'dark';
      if (prevMode === 'dark') return 'system';
      return 'light';
    });
  };

  // 提供上下文值
  const contextValue: ThemeContextType = {
    mode,
    setMode,
    toggleColorMode,
    theme,
  };

  return (
    <ThemeContext.Provider value={contextValue} >
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};