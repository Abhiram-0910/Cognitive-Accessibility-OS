// =================================================================================
// JIRA DOM INTERCEPTOR
// =================================================================================

const isJira = window.location.hostname.includes('atlassian.net');

if (isJira) {
  console.log("[NeuroAdaptive] Jira environment detected. Initializing ticket interceptor.");

  const jiraObserver = new MutationObserver(() => {
    // Jira's DOM is complex and dynamic. We look for the main issue header (h1).
    // Specifically targeting the container that holds the ticket summary/title.
    const titleContainer = document.querySelector('h1[data-testid="issue.views.issue-base.foundation.summary.heading"]');
    
    // Check if we already injected the button to prevent duplicates
    if (titleContainer && !document.getElementById('neuro-jira-decompose-btn')) {
      injectJiraButton(titleContainer);
    }
  });

  // Start observing the body for dynamic Jira ticket loads (SPAs)
  jiraObserver.observe(document.body, { childList: true, subtree: true });
}

function injectJiraButton(targetElement) {
  // Create the NeuroAdaptive Action Button
  const neuroBtn = document.createElement('button');
  neuroBtn.id = 'neuro-jira-decompose-btn';
  
  // Style it to look distinct but professional (NeuroAdaptive Teal)
  neuroBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
    Decompose for NeuroAdapt
  `;
  
  Object.assign(neuroBtn.style, {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '16px',
    padding: '6px 12px',
    backgroundColor: '#14B8A6', // Teal 500
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    verticalAlign: 'middle'
  });

  neuroBtn.onmouseover = () => neuroBtn.style.backgroundColor = '#0D9488'; // Teal 600
  neuroBtn.onmouseout = () => neuroBtn.style.backgroundColor = '#14B8A6';

  // The Extraction Logic
  neuroBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Scrape Title
    const ticketTitle = targetElement.innerText || 'Unknown Ticket';
    
    // Scrape Description
    // Jira descriptions are often housed in specific test-id containers or standard user-content divs
    const descriptionElement = document.querySelector('div[data-testid="issue.views.field.rich-text.description"]') 
                            || document.querySelector('.user-content-block');
                            
    const ticketDescription = descriptionElement ? descriptionElement.innerText : 'No description found.';

    const combinedTaskContext = `Jira Ticket: ${ticketTitle}\n\nDetails: ${ticketDescription}`;
    console.log("[NeuroAdaptive] Extracted Jira Payload:", combinedTaskContext);

    // Communicate with the Extension Background Script or Web App
    // In a full implementation, this sends a message to your web app to open the MicroTasker
    // passing the combinedTaskContext as the input.
    
    // For the UI feedback:
    neuroBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      Sending to OS...
    `;
    neuroBtn.style.backgroundColor = '#10B981'; // Emerald
    
    // Reset button after 2 seconds
    setTimeout(() => {
      neuroBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        Decompose for NeuroAdapt
      `;
      neuroBtn.style.backgroundColor = '#14B8A6';
    }, 2000);
    
    // Alert for the hackathon demo if not fully wired to the React tab
    // alert("Task intercepted! Open your NeuroAdaptive OS tab to see the Micro-Task breakdown.");
  });

  // Inject next to the H1 title
  // We append it to the title's parent container to keep alignment
  if (targetElement.parentNode) {
    targetElement.parentNode.style.display = 'flex';
    targetElement.parentNode.style.alignItems = 'center';
    targetElement.parentNode.appendChild(neuroBtn);
  }
}