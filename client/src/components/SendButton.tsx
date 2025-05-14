import React, { MouseEvent } from 'react';
import GradientButton from './GradientButton';

interface SendButtonProps {
  onSend: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

const SendButton: React.FC<SendButtonProps> = ({
  onSend,
  disabled = false,
  isLoading = false
}) => {
  return (
    <div className="send-button-container">
      <GradientButton
        onClick={onSend}
        type="submit"
        disabled={disabled || isLoading}
        className="send-button"
        variant="primary"
        size="md"
      >
        {isLoading ? (
          <span className="send-button-loading">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </span>
        ) : (
          <span className="send-button-text">发送</span>
        )}
      </GradientButton>
    </div>
  );
};

export default SendButton;