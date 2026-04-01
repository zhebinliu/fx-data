import { createTheme } from '@mui/material/styles';


const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#165DFF', // Arco Design default blue
        },
        background: {
            default: '#f4f5f7', // Light gray background often used in enterprise apps
            paper: '#ffffff',
        },
    },
    typography: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none', // Disable uppercase for buttons
                    borderRadius: '4px', // Match Arco's slight rounding
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: '#ffffff',
                    color: '#333333',
                    boxShadow: '0 1px 4px rgba(0,21,41,.08)', // Subtle shadow like Arco/Ant
                },
            },
        },
    },
});

export default theme;
