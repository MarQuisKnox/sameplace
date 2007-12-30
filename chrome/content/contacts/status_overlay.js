/*
 * Copyright 2006-2007 by Massimiliano Mirra
 * 
 * This file is part of SamePlace.
 * 
 * SamePlace is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 * 
 * SamePlace is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */


// GUI REACTIONS
// ----------------------------------------------------------------------

function requestedChangeStatus(xulStatus) {
    function previousPresenceStanza(account) {
        var p = XMPP.cache.fetch({
            event     : 'presence',
            account   : account,
            direction : 'out',
            stanza    : function(s) { return s.ns_muc::x == undefined; }
        })[0];

        return p ? p.stanza : null;
    }

    function updatePresence(stanza, status) {
        var newStanza = stanza.copy();
    
        switch(status) {
        case 'available':
            delete newStanza.show;
            break;
        case 'away':
            newStanza.show = <show>away</show>;
            break;
        case 'dnd':
            newStanza.show = <show>dnd</show>;
            break;
        }
        return newStanza;
    }
    
    var status = xulStatus.value;
    var account = $(xulStatus, '^ .account').value;

    if(account == 'all') {
        var accountsUp = XMPP.accounts.filter(XMPP.isUp);
        if(status == 'unavailable')
            accountsUp.forEach(XMPP.down);
        else if(status == 'available' && accountsUp.length == 0)
            XMPP.accounts.forEach(XMPP.up);
        else
            accountsUp.forEach(function(account) {
                XMPP.send(account,
                          updatePresence(
                              previousPresenceStanza(account.jid) || <presence/>,
                              status));
            });
    } else {
        if(status == 'available' && XMPP.isDown(account))
            XMPP.up(account);
        else if(status == 'unavailable' && XMPP.isUp(account))
            XMPP.down(account);
        else
            XMPP.send(account,
                      updatePresence(
                          previousPresenceStanza(account) || <presence/>,
                          status));
    } 

}


// GUI ACTIONS
// ----------------------------------------------------------------------

function refreshAccounts(menuPopup) {
    function refreshAccounts1() {
        while(menuPopup.lastChild &&
              menuPopup.lastChild.nodeName != 'menuseparator')
            menuPopup.removeChild(menuPopup.lastChild);
        
        XMPP.accounts.forEach(function(account) {
            var accountPresence =
                XMPP.cache.fetch({
                    event     : 'presence',
                    direction : 'out',
                    account   : account.jid,
                    stanza    : function(s) { return s.ns_muc::x == undefined; }
                    })[0] ||
                { stanza: <presence type="unavailable"/> };

            var menu = document.createElement('menu');
            menu.setAttribute('class', 'menu-iconic account')
            menu.setAttribute('label', account.jid);
            menu.setAttribute('value', account.jid);
            menu.setAttribute('availability',
                              accountPresence.stanza.@type == undefined ?
                              'available' : 'unavailable');
            menu.setAttribute('show',
                              accountPresence.stanza.show.toString());
  
            menu.appendChild($('#blueprints > .status-menu').cloneNode(true));
            menuPopup.appendChild(menu);
        });
    }

    // When called from the event listener and adding menus with
    // sub-menus, will crash as soon as mouse hovers a menu (for someh
    // reason).  The following seems to workaround.
    window.setTimeout(refreshAccounts1, 0);
}