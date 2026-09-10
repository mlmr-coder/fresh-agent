import { User } from '../../components/icons.jsx';
import { AppIcon, deptLabelFor, personaText } from './persona-shared.jsx';
import './persona-chat-notice.css';

export function PersonaChatNotice({ card, removedName, t }) {
  if (removedName !== undefined) {
    return (
      <div className="persona-chat-removal" data-testid="persona-chat-removal">
        <span className="persona-chat-removal-icon"><User size={14} /></span>
        <span className="persona-chat-removal-name">{removedName}</span>
        <span>{t.cpExpertRemoved}</span>
      </div>
    );
  }
  const expert = personaText(card || {}, t);
  const department = deptLabelFor(t, expert.dept);
  return (
    <div className="persona-chat-notice" data-testid="persona-chat-notice">
      <AppIcon card={card} cls="persona-chat-avatar" fb={18} />
      <div className="persona-chat-copy">
        <div className="persona-chat-heading">
          <span className="persona-chat-name">{expert.name}</span>
          <span className="persona-chat-status">{t.cpExpertJoined}</span>
        </div>
        {department && <div className="persona-chat-department">{department}</div>}
        {expert.description && <p className="persona-chat-description" title={expert.description}>{expert.description}</p>}
      </div>
    </div>
  );
}
