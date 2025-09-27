import React, { forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { clsx } from 'clsx';
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Type } from 'lucide-react';

export interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  readOnly?: boolean;
  height?: number;
  id?: string;
  showToolbar?: boolean;
}

export interface RichTextEditorRef {
  focus: () => void;
  blur: () => void;
  getEditor: () => Editor | null;
  getText: () => string;
  getHTML: () => string;
  isEmpty: () => boolean;
  clear: () => void;
}

// Toolbar Button Component
const ToolbarButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, isActive, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={clsx(
      'p-2 rounded border text-sm transition-colors duration-200',
      {
        'bg-brand-brown text-white border-brand-brown': isActive,
        'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100': !isActive && !disabled,
        'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed': disabled,
      }
    )}
  >
    {children}
  </button>
);

// Main Toolbar Component
const Toolbar: React.FC<{ editor: Editor | null; disabled?: boolean }> = ({ editor, disabled }) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-300 bg-gray-50 rounded-t-lg">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        disabled={disabled}
        title="Bold"
      >
        <Bold size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        disabled={disabled}
        title="Italic"
      >
        <Italic size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        disabled={disabled}
        title="Strikethrough"
      >
        <Underline size={16} />
      </ToolbarButton>

      <div className="w-px h-8 bg-gray-300 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        disabled={disabled}
        title="Bullet List"
      >
        <List size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        disabled={disabled}
        title="Ordered List"
      >
        <ListOrdered size={16} />
      </ToolbarButton>

      <div className="w-px h-8 bg-gray-300 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        disabled={disabled}
        title="Heading"
      >
        <Type size={16} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => {
          const url = window.prompt('Enter URL:');
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        isActive={editor.isActive('link')}
        disabled={disabled}
        title="Add Link"
      >
        <LinkIcon size={16} />
      </ToolbarButton>
    </div>
  );
};

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  value = '',
  onChange,
  placeholder = 'Start typing...',
  className,
  disabled = false,
  error,
  label,
  required = false,
  readOnly = false,
  height = 200,
  id,
  showToolbar = true,
}, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-brand-brown underline hover:text-brand-brown-dark',
        },
      }),
    ],
    content: value,
    editable: !disabled && !readOnly,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: clsx(
          'prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none',
          'min-h-[150px] p-3 border-0'
        ),
        placeholder,
      },
    },
  });

  useImperativeHandle(ref, () => ({
    focus: () => {
      editor?.commands.focus();
    },
    blur: () => {
      editor?.commands.blur();
    },
    getEditor: () => editor,
    getText: () => editor?.getText() || '',
    getHTML: () => editor?.getHTML() || '',
    isEmpty: () => editor?.isEmpty ?? true,
    clear: () => {
      editor?.commands.clearContent();
    },
  }));

  const containerClassName = clsx(
    'rich-text-editor',
    {
      'rich-text-editor--error': error,
      'rich-text-editor--disabled': disabled,
      'rich-text-editor--readonly': readOnly,
    },
    className
  );

  return (
    <div className={containerClassName}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        className={clsx(
          'border border-gray-300 rounded-lg overflow-hidden',
          {
            'border-red-500': error,
            'opacity-50': disabled,
            'bg-gray-50': readOnly,
          }
        )}
        style={{ minHeight: `${height}px` }}
      >
        {showToolbar && !readOnly && (
          <Toolbar editor={editor} disabled={disabled} />
        )}

        <div
          className={clsx(
            'editor-content',
            {
              'border-t border-gray-300': showToolbar && !readOnly,
            }
          )}
          style={{ minHeight: `${height - (showToolbar ? 48 : 0)}px` }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';