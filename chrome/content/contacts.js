/*
  Copyright (C) 2005-2006 by Massimiliano Mirra

  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 2 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301 USA

  Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
*/


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

var Cc = Components.classes;
var Ci = Components.interfaces;

var srvPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);
var prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService)
    .getBranch('extensions.sameplace.');

var subscriptionDesc = {
    'both': 'Both see when other is online',
    'from': 'Contact sees when you are online',
    'to': 'You see when contact is online',
    'none': 'Neither sees when other is online'
}


// GLOBAL STATE
// ----------------------------------------------------------------------

var channel;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    _('contacts').selectedIndex = -1;

    channel = XMPP.createChannel();

    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.@type == undefined || s.@type == 'unavailable';
            }},
        function(presence) { receivedPresence(presence) });
    channel.on(
        {event: 'iq', direction: 'in', stanza: function(s) {
                return s.ns_roster::query.length() > 0;
            }},
        function(iq) { receivedRoster(iq); });
    channel.on(
        {event: 'message', direction: 'in'},
        function(message) {
            receivedMessage(message);
        });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.@type == 'subscribe';
            }},
        function(presence) { receivedSubscriptionRequest(presence); });
    channel.on(
        {event: 'presence', direction: 'in', stanza: function(s) {
                return s.ns_muc_user::x.length() > 0;
            }}, function(presence) { receivedMUCPresence(presence) });
    channel.on(
        {event: 'iq', direction: 'in', stanza: function(s) {
                return s.@type == 'result' &&
                    s.ns_private::query.ns_bookmarks::storage != undefined;
            }}, function(iq) { receivedBookmarks(iq); });

	XMPP.cache.fetch({
        event: 'iq',
        direction: 'in',
        stanza: function(s) {
                return s.ns_roster::query.length() > 0;
            }})
        .forEach(receivedRoster);

    XMPP.cache.fetch({
        event: 'presence',
        direction: 'in',
        })
        .forEach(receivedPresence);
}

function finish() {
    channel.release();
}


// INTERFACE GLUE
// ----------------------------------------------------------------------

if(typeof(x) == 'function') {
    function get(account, address) {
        return x('//*[@id="contacts"]//*[' +
                 '@address="' + address + '" and ' +
                 '@account="' + account + '"]');
    }
} else {
    function get(account, address) {
        var addresses = _('contacts').getElementsByAttribute('address', address);
        for(var i=0; i<addresses.length; i++)
            if(addresses[i].getAttributeNode('account').value == account)
                return addresses[i];
        return undefined;
    }
}


function add(account, address) {
    var contact;
    contact = cloneBlueprint('contact');
    contact.setAttribute('address', address);
    contact.setAttribute('account', account);
    contact.setAttribute('availability', 'unavailable');
    contact.getElementsByAttribute('role', 'name')[0].setAttribute('value', address);
    _('contacts').appendChild(contact);
    return contact;
}


// DOMAIN REACTIONS
// ----------------------------------------------------------------------

function receivedMessage(message) {
    var account = message.session.name;
    var address = XMPP.JID(message.stanza.@from).address;

    var contact = get(account, address) || add(account, address);

    if(contact.getAttribute('current') != 'true' &&
       message.stanza.body.length() > 0) {
        var pending = parseInt(_(contact, {role: 'pending'}).value);
        _(contact, {role: 'pending'}).value = pending + 1;
    }

    if(message.stanza.ns_event::x.length() > 0)
        if(message.stanza.ns_event::x.composing.length() > 0)
            contact.setAttribute('chatstate', 'composing');
        else
            contact.setAttribute('chatstate', 'active');
    
    if(message.stanza.ns_chatstates::*.length() > 0)
        contact.setAttribute(
            'chatstate', message.stanza.ns_chatstates::*[0].localName());
}

function messagesSeen(account, address) {
    var contact = get(account, address) || add(account, address);

    _(contact, {role: 'pending'}).value = 0;
}

function nowTalkingWith(account, address) {
    var previouslyTalking = _('contacts', {current: 'true'});
    if(previouslyTalking)
        previouslyTalking.setAttribute('current', 'false');

    var contact = get(account, address) || add(account, address);
    contact.setAttribute('current', 'true');
    _(contact, {role: 'pending'}).value = 0;
}

function contactChangedRelationship(account, address, subscription, name) {
    var contact = get(account, address) || add(account, address);

    if(subscription)
        if(subscription == 'remove') {
            _('contacts').removeChild(contact);
            return;
        }
        else
            contact.setAttribute('subscription', subscription);

    var nameElement = contact.getElementsByAttribute('role', 'name')[0];
    if(name)
        nameElement.setAttribute('value', name);
    else if(name == '' || !nameElement.hasAttribute('value'))
        nameElement.setAttribute('value', address);

    _reposition(contact);
}

function resourceChangedPresence(account, address) {
    var contact = get(account, address) || add(account, address);
    var summary = XMPP.presenceSummary(account, address);

    contact.setAttribute('availability', summary.stanza.@type.toString() || 'available');
    contact.setAttribute('show', summary.stanza.show.toString());

    _reposition(contact);

    if(summary.stanza.status == undefined ||
       summary.stanza.status == '')
        _(contact, {role: 'status'}).removeAttribute('value');
    else
        _(contact, {role: 'status'}).value = summary.stanza.status;

    if(summary.stanza.@type == 'unavailable')
        contact.setAttribute('chatstate', '');
}

function _reposition(contact) {
    var availability = contact.getAttribute('availability');
    var show = contact.getAttribute('show');

    _('contacts').removeChild(contact);
    contact.style.opacity = 0;

    var sibling;
    if(contact.getAttribute('open') == 'true')
        sibling = _('contacts', {role: 'open'}).nextSibling;
    else if(availability == 'available' && show == '')
        sibling = _('contacts', {role: 'online'}).nextSibling;
    else if(availability == 'available' && show == 'chat')
        sibling = _('contacts', {role: 'online'}).nextSibling;
    else if(availability == 'available' && show == 'away')
        sibling = _('contacts', {role: 'away'}).nextSibling;
    else if(availability == 'available' && show == 'xa')
        sibling = _('contacts', {role: 'away'}).nextSibling;
    else if(availability == 'available' && show == 'dnd')
        sibling = _('contacts', {role: 'dnd'}).nextSibling;
    else
        sibling = _('contacts', {role: 'offline'}).nextSibling;

    while(sibling &&
          sibling.getAttribute('role') == 'contact' &&
          sibling.getElementsByAttribute('role', 'name')[0].getAttribute('value').toLowerCase() < 
          contact.getElementsByAttribute('role', 'name')[0].getAttribute('value').toLowerCase())
        sibling = sibling.nextSibling;
    
    if(!sibling)
        _('contacts').appendChild(contact);
    else
        _('contacts').insertBefore(contact, sibling);
    
    fadeIn(contact);
}

// XXX now actually asserting an interaction that might be already
// happening.  interactingWith() might be a better name.  Also
// there might be some overlap with nowTalkingWith().

function startedConversationWith(account, address) {
    var contact = get(account, address) || add(account, address);

    if(getContactPosition(contact) != 'open') {
        contact.setAttribute('open', 'true');
        _reposition(contact);
    }
}

function stoppedConversationWith(account, address) {
    var contact = get(account, address);
    if(contact) {
        contact.setAttribute('open', 'false');
        _reposition(contact);
    }
}


// NETWORK ACTIONS
// ----------------------------------------------------------------------

function addContact(account, address, subscribe) {
    XMPP.send(
        account,
        <iq type='set' id='set1'>
        <query xmlns='jabber:iq:roster'>
        <item jid={address}/>
        </query></iq>);

    XMPP.send(account, <presence to={address} type="subscribe"/>);
}

function acceptSubscriptionRequest(account, address) {
    XMPP.send(
        account,
        <presence to={address} type="subscribed"/>);
}


// NETWORK REACTIONS
// ----------------------------------------------------------------------

function receivedBookmarks(iq) {
    for each(var room in iq
             .stanza.ns_private::query
             .ns_bookmarks::storage
             .ns_bookmarks::conference) {
        var account = iq.session.name;
        var address = XMPP.JID(room.@jid).address;
        var xulRoom = get(account, address) || add(account, address);
    }
}

function receivedPresence(presence) {
    var from = XMPP.JID(presence.stanza.@from);

    resourceChangedPresence(presence.session.name, from.address);
}

function receivedRoster(iq) {
    function watchForSubscriptionApproval(item) {
        var listener = channel.on({
            event     : 'presence',
            direction : 'in',
            stanza    : function(s) {
                    return (s.@type == 'subscribed' &&
                            s.@from == item.@jid);
                }},
            function(presence) {
                channel.forget(listener);
                receivedSubscriptionApproval(presence);
            });
    }

    for each(var item in iq.stanza..ns_roster::item) {
        if(item.@ask == 'subscribe')
            watchForSubscriptionApproval(item);

        contactChangedRelationship(
            iq.session.name,
            item.@jid,
            item.@subscription,
            item.@name.toString());
    }
}

function receivedSubscriptionRequest(presence) {
    _('notify').appendNotification(
            'Request from ' + presence.stanza.@from,
            'sameplace-presence-subscription',
            null, _('notify').PRIORITY_INFO_HIGH,
            [{label: 'View', accessKey: 'V', callback: onView}]);

    function onView() {
        var account = presence.session.name;
        var address = presence.stanza.@from.toString();
        var accept, reciprocate;

        if(get(account, address) == undefined ||
           get(account, address).getAttribute('subscription') == 'none') {
            var check = {value: true};
            accept = srvPrompt.confirmCheck(
                null, 'Contact notification',
                address + ' wants to add ' + presence.stanza.@to + ' to his/her contact list.\nDo you accept?',
                'Also add ' + address + ' to my contact list', check);
            reciprocate = check.value;
        }
        else
            accept = srvPrompt.confirm(
                null, 'Contact notification',
                address + ' wants to add ' + presence.stanza.@to + ' to his/her contact list.\nDo you accept?');

        if(accept) {
            acceptSubscriptionRequest(account, address);
            if(reciprocate)
                addContact(account, address);
        }        
    }
}

function receivedSubscriptionApproval(presence) {
    _('notify').appendNotification(
        presence.stanza.@from + ' has accepted to be in your contact list.',
        'sameplace-presence-subscription',
        null, _('notify').PRIORITY_INFO_HIGH, []);

    XMPP.send(presence.account,
              <presence to={XMPP.JID(presence.stanza.@from).address} type="subscribe"/>);
}

function receivedMUCPresence(presence) {
    var from = XMPP.JID(presence.stanza.@from);

    resourceChangedPresence(
        presence.session.name,
        from.address,
        from.resource,
        presence.stanza.@type);
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function getContactPosition(contact) {
    var previousElement = contact.previousSibling;
    while(previousElement) {
        // XXX Hackish.  These are not "roles"... "status" would be
        // more appropriate.
        
        if(previousElement.nodeName == 'label' ||
           previousElement.nodeName == 'spacer') {
            var role = previousElement.getAttribute('role');
            if(['open', 'online', 'away', 'dnd', 'offline'].indexOf(role) != -1)
                return role;
        }
        
        previousElement = previousElement.previousSibling;
    }
    return undefined;        
}


// GUI REACTIONS
// ----------------------------------------------------------------------

function requestedUpdateContactTooltip(element) {
    _('contact-tooltip', {role: 'name'}).value =
        XMPP.nickFor(attr(element, 'account'), attr(element, 'address'));
    _('contact-tooltip', {role: 'address'}).value = attr(element, 'address');
    _('contact-tooltip', {role: 'account'}).value = attr(element, 'account');

    var subscriptionState = attr(element, 'subscription');
    if(subscriptionState) {
        _('contact-tooltip', {role: 'subscription'}).value = subscriptionDesc[subscriptionState];
        _('contact-tooltip', {role: 'subscription'}).parentNode.hidden = false;
    } else
        _('contact-tooltip', {role: 'subscription'}).parentNode.hidden = true;
}

function requestedSetContactAlias(element) {
    var account = attr(element, 'account');
    var address = attr(element, 'address');
    var alias = { value: XMPP.nickFor(account, address) };

    var confirm = srvPrompt.prompt(
        null, 'Alias Change', 'Choose an alias for ' + address, alias, null, {});

    if(confirm)
        XMPP.send(account,
                  <iq type="set"><query xmlns="jabber:iq:roster">
                  <item jid={address} name={alias.value}/>
                  </query></iq>);
}

function requestedRemoveContact(element) {
    var account = attr(element, 'account');
    var address = attr(element, 'address');

    XMPP.send(account,
              <iq type="set"><query xmlns="jabber:iq:roster">
              <item jid={address} subscription="remove"/>
              </query></iq>);
}

function clickedContact(contact) {
    requestedCommunicate(contact, getDefaultAppUrl())
}

function requestedCommunicate(contact, url) {
    if(onRequestedCommunicate)
        onRequestedCommunicate(
            attr(contact, 'account'),
            attr(contact, 'address'),
            url);
}


// GUI UTILITIES (SPECIFIC)
// ----------------------------------------------------------------------

function getDefaultAppUrl() {
    var url = prefBranch.getCharPref('defaultAppUrl');
    return isChromeUrl(url) ? chromeToFileUrl(url) : url;
}

