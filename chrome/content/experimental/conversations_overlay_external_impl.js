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
 * The interactive user interfaces in modified source and object code
 * versions of this program must display Appropriate Legal Notices, as
 * required under Section 5 of the GNU General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU General Public License
 * version 3, modified versions must display the "Powered by SamePlace"
 * logo to users in a legible manner and the GPLv3 text must be made
 * available to them.
 * 
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */


// DEFINITIONS
// ----------------------------------------------------------------------


// STATE
// ----------------------------------------------------------------------

var channel;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init() {
    window.addEventListener('contact/select', selectedContact, false);
    channel = XMPP.createChannel();
}

function finish() {
    channel.release();
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function selectedContact(event) {
    var account = event.target.getAttribute('account');
    var address = event.target.getAttribute('address');
    var convWindow =
        Cc['@mozilla.org/appshell/window-mediator;1']
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow('SamePlace:Conversations') ||
        window.open('chrome://sameplace/content/experimental/conversations.xul',
                    'SamePlace:Conversations', 'chrome');

    if(convWindow.document.location.href == 'about:blank')
        convWindow.addEventListener('load', function(event) {
            convWindow.selectedContact(account, address);
        }, false);
    else
        convWindow.selectedContact(account, address);
}
