export const APP_FONT_STORAGE_KEY = 'gad_admin_app_font';

export const appFontOptions = [
  {
    label: 'System Default',
    value: 'system',
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
  },
  {
    label: 'Segoe UI',
    value: 'segoe',
    family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  {
    label: 'Arial',
    value: 'arial',
    family: "Arial, 'Helvetica Neue', sans-serif"
  },
  {
    label: 'Helvetica',
    value: 'helvetica',
    family: "'Helvetica Neue', Helvetica, Arial, sans-serif"
  },
  {
    label: 'Tahoma',
    value: 'tahoma',
    family: "Tahoma, Geneva, sans-serif"
  },
  {
    label: 'Verdana',
    value: 'verdana',
    family: "Verdana, Geneva, sans-serif"
  },
  {
    label: 'Trebuchet MS',
    value: 'trebuchet',
    family: "'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', sans-serif"
  },
  {
    label: 'Gill Sans',
    value: 'gillsans',
    family: "'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif"
  },
  {
    label: 'Georgia',
    value: 'georgia',
    family: "Georgia, 'Times New Roman', serif"
  },
  {
    label: 'Times New Roman',
    value: 'times',
    family: "'Times New Roman', Times, serif"
  },
  {
    label: 'Palatino',
    value: 'palatino',
    family: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif"
  },
  {
    label: 'Garamond',
    value: 'garamond',
    family: "Garamond, 'Bookman Old Style', serif"
  },
  {
    label: 'Courier New',
    value: 'courier',
    family: "'Courier New', Courier, monospace"
  },
  {
    label: 'Lucida Console',
    value: 'lucidaconsole',
    family: "'Lucida Console', Monaco, monospace"
  },
  {
    label: 'Monaco',
    value: 'monaco',
    family: "Monaco, 'Lucida Console', monospace"
  },
  {
    label: 'Impact',
    value: 'impact',
    family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
  }
];

export const getStoredAppFont = () => {
  if (typeof window === 'undefined') return appFontOptions[0].value;
  const storedFont = window.localStorage.getItem(APP_FONT_STORAGE_KEY);
  return appFontOptions.some((option) => option.value === storedFont)
    ? storedFont
    : appFontOptions[0].value;
};

export const applyAppFont = (fontValue = appFontOptions[0].value) => {
  if (typeof document === 'undefined') return;
  const selectedFont = appFontOptions.find((option) => option.value === fontValue) || appFontOptions[0];
  document.documentElement.style.setProperty('--app-font-family', selectedFont.family);
};

export const storeAndApplyAppFont = (fontValue) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(APP_FONT_STORAGE_KEY, fontValue);
  }
  applyAppFont(fontValue);
};
