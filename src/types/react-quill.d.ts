declare module 'react-quill' {
    import React from 'react';
    export interface ReactQuillProps {
        theme?: string;
        modules?: any;
        formats?: string[];
        value?: string;
        onChange?: (content: string, delta: any, source: string, editor: any) => void;
        readOnly?: boolean;
        style?: React.CSSProperties;
        className?: string;
        placeholder?: string;
    }
    export default class ReactQuill extends React.Component<ReactQuillProps> { }
}
