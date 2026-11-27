// Facebook collapses extra blank lines in both photo captions and video descriptions.
// No other content or whitespace is relaxed.
export function facebookCaptionsMatch(actual,approved){
 return typeof actual==='string'&&typeof approved==='string'&&actual.replace(/\n{3,}/g,'\n\n')===approved.replace(/\n{3,}/g,'\n\n');
}
