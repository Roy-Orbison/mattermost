// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';
import type {ValueType} from 'react-select';

import {BellOffOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel, ChannelMembership, ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserNotifyProps, UserProfile} from '@mattermost/types/users';

import AlertBanner from 'components/alert_banner';
import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';
import CheckboxWithSelectSettingItem from 'components/widgets/modals/components/checkbox_with_select_item';
import ModalHeader from 'components/widgets/modals/components/modal_header';
import ModalSection from 'components/widgets/modals/components/modal_section';
import RadioSettingItem from 'components/widgets/modals/components/radio_setting_item';
import type {Option} from 'components/widgets/modals/components/react_select_item';

import {NotificationLevels, DesktopSound, IgnoreChannelMentions} from 'utils/constants';
import {getValueOfNotificationSoundsSelect, notificationSoundKeys, stopTryNotificationRing, tryNotificationSound} from 'utils/notification_sounds';

import ResetToDefaultButton, {SectionName, convertDesktopSoundNotifyPropFromUserToDesktop} from './reset_to_default_button';
import utils from './utils';

import type {PropsFromRedux} from './index';

import './channel_notifications_modal.scss';

export type Props = PropsFromRedux & {

    /**
     * Function that is called when the modal has been hidden and should be removed
     */
    onExited: () => void;

    /**
     * Object with info about current channel
     */
    channel: Channel;

    /**
     * Object with info about current user
     */
    currentUser: UserProfile;
};

export default function ChannelNotificationsModal(props: Props) {
    const {formatMessage} = useIntl();

    const [show, setShow] = useState(true);
    const [serverError, setServerError] = useState('');

    const [settings, setSettings] = useState<Omit<ChannelNotifyProps, 'email'>>(getStateFromNotifyProps(props.currentUser.notify_props, props.channelMember?.notify_props));

    const [desktopAndMobileSettingsDifferent, setDesktopAndMobileSettingDifferent] = useState<boolean>(areDesktopAndMobileSettingsDifferent(
        props.collapsedReplyThreads,
        getInitialValuesOfChannelNotifyProps('desktop', props.currentUser.notify_props, props.channelMember?.notify_props),
        getInitialValuesOfChannelNotifyProps('push', props.currentUser.notify_props, props.channelMember?.notify_props),
        getInitialValuesOfChannelNotifyProps('desktop_threads', props.currentUser.notify_props, props.channelMember?.notify_props),
        getInitialValuesOfChannelNotifyProps('push_threads', props.currentUser.notify_props, props.channelMember?.notify_props),
    ));

    function handleHide() {
        setShow(false);
    }

    const handleChange = useCallback((values: Record<string, string>) => {
        setSettings((prevSettings) => ({...prevSettings, ...values}));
    }, []);

    function handleUseSameMobileSettingsAsDesktopCheckboxChange() {
        setDesktopAndMobileSettingDifferent(!desktopAndMobileSettingsDifferent);
    }

    function handleResetToDefaultClicked(channelNotifyPropsDefaultedToUserNotifyProps: ChannelMembership['notify_props'], sectionName: SectionName) {
        if (sectionName === SectionName.Mobile) {
            const desktopAndMobileSettingsDifferent = areDesktopAndMobileSettingsDifferent(
                props.collapsedReplyThreads,
                settings.desktop,
                channelNotifyPropsDefaultedToUserNotifyProps.push,
                settings.desktop_threads,
                channelNotifyPropsDefaultedToUserNotifyProps.push_threads,
            );

            setDesktopAndMobileSettingDifferent(desktopAndMobileSettingsDifferent);
        }

        setSettings({...settings, ...channelNotifyPropsDefaultedToUserNotifyProps});
    }

    function handleSave() {
        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(props.currentUser.notify_props, settings, props.collapsedReplyThreads, desktopAndMobileSettingsDifferent);

        props.actions.updateChannelNotifyProps(props.currentUser.id, props.channel.id, channelNotifyProps).then((value) => {
            const {error} = value;
            if (error) {
                setServerError(error.message);
            } else {
                handleHide();
            }
        });
    }

    const muteOrIgnoreSectionContent = (
        <>
            <CheckboxSettingItem
                inputFieldTitle={
                    <FormattedMessage
                        id='channel_notifications.muteChannelTitle'
                        defaultMessage='Mute channel'
                    />
                }
                description={formatMessage({
                    id: 'channel_notifications.muteChannelDesc',
                    defaultMessage: 'Turns off notifications for this channel. You\'ll still see badges if you\'re mentioned.',
                })}
                inputFieldValue={settings.mark_unread === 'mention'}
                inputFieldData={utils.MuteChannelInputFieldData}
                handleChange={(e) => handleChange({mark_unread: e ? 'mention' : 'all'})}
            />
            <CheckboxSettingItem
                inputFieldTitle={
                    <FormattedMessage
                        id='channel_notifications.ignoreMentionsTitle'
                        defaultMessage='Ignore mentions for @channel, @here and @all'
                    />
                }
                description={formatMessage({
                    id: 'channel_notifications.ignoreMentionsDesc',
                    defaultMessage: 'When enabled, @channel, @here and @all will not trigger mentions or mention notifications in this channel',
                })}
                inputFieldValue={settings.ignore_channel_mentions === 'on'}
                inputFieldData={utils.IgnoreMentionsInputFieldData}
                handleChange={(e) => handleChange({ignore_channel_mentions: e ? 'on' : 'off'})}
            />
        </>
    );

    const handleChangeForMessageNotificationSoundSelect = (selectedOption: ValueType<Option>) => {
        stopTryNotificationRing();

        if (selectedOption && 'value' in selectedOption) {
            handleChange({desktop_notification_sound: ((selectedOption as Option).value)});
            tryNotificationSound(selectedOption.value);
        }
    };

    const desktopNotificationsSectionContent = (
        <>
            <RadioSettingItem
                title={formatMessage({
                    id: 'channel_notifications.NotifyMeTitle',
                    defaultMessage: 'Notify me about…',
                })}
                inputFieldValue={settings.desktop || ''}
                inputFieldData={utils.desktopNotificationInputFieldData(props.currentUser.notify_props.desktop)}
                handleChange={(e) => handleChange({desktop: e.target.value})}
            />
            {props.collapsedReplyThreads && settings.desktop === 'mention' &&
                <CheckboxSettingItem
                    title={formatMessage({
                        id: 'channel_notifications.ThreadsReplyTitle',
                        defaultMessage: 'Thread reply notifications',
                    })}
                    inputFieldValue={settings.desktop_threads === 'all'}
                    inputFieldData={utils.DesktopReplyThreadsInputFieldData}
                    inputFieldTitle={
                        <FormattedMessage
                            id='channel_notifications.checkbox.threadsReplyTitle'
                            defaultMessage="Notify me about replies to threads I\'m following"
                        />
                    }
                    handleChange={(e) => handleChange({desktop_threads: e ? 'all' : 'mention'})}
                />
            }
            {settings.desktop !== 'none' && (
                <CheckboxWithSelectSettingItem
                    title={formatMessage({
                        id: 'channel_notifications.desktopNotifications.title',
                        defaultMessage: 'Sounds',
                    })}
                    checkboxFieldTitle={
                        <FormattedMessage
                            id='channel_notifications.desktopNotifications.soundEnable'
                            defaultMessage='Message notification sounds'
                        />
                    }
                    checkboxFieldValue={settings.desktop_sound === DesktopSound.ON}
                    checkboxFieldData={utils.desktopNotificationSoundsCheckboxFieldData}
                    handleCheckboxChange={(isChecked) => handleChange({desktop_sound: isChecked ? DesktopSound.ON : DesktopSound.OFF})}
                    selectFieldData={utils.desktopNotificationSoundsSelectFieldData}
                    selectFieldValue={getValueOfNotificationSoundsSelect(settings.desktop_notification_sound)}
                    isSelectDisabled={settings.desktop_sound !== 'on'}
                    selectPlaceholder={formatMessage({
                        id: 'channel_notifications.desktopNotifications.soundSelectPlaceholder',
                        defaultMessage: 'Select a sound',
                    })}
                    handleSelectChange={handleChangeForMessageNotificationSoundSelect}
                />
            )}
        </>
    );

    const mobileNotificationsSectionContent = (
        <>
            <CheckboxSettingItem
                inputFieldTitle={
                    <FormattedMessage
                        id='channel_notifications.checkbox.sameMobileSettingsDesktop'
                        defaultMessage='Use the same notification settings as desktop'
                    />
                }
                inputFieldValue={!desktopAndMobileSettingsDifferent}
                inputFieldData={utils.sameMobileSettingsDesktopInputFieldData}
                handleChange={handleUseSameMobileSettingsAsDesktopCheckboxChange}
            />
            {desktopAndMobileSettingsDifferent && (
                <>
                    <RadioSettingItem
                        title={formatMessage({
                            id: 'channel_notifications.NotifyMeTitle',
                            defaultMessage: 'Notify me about…',
                        })}
                        inputFieldValue={settings.push || ''}
                        inputFieldData={utils.mobileNotificationInputFieldData(props.currentUser.notify_props.push)}
                        handleChange={(e) => handleChange({push: e.target.value})}
                    />
                    {props.collapsedReplyThreads && settings.push === 'mention' &&
                    <CheckboxSettingItem
                        title={formatMessage({
                            id: 'channel_notifications.ThreadsReplyTitle',
                            defaultMessage: 'Thread reply notifications',
                        })}
                        inputFieldTitle={
                            <FormattedMessage
                                id='channel_notifications.checkbox.threadsReplyTitle'
                                defaultMessage="Notify me about replies to threads I\'m following"
                            />
                        }
                        inputFieldValue={settings.push_threads === 'all'}
                        inputFieldData={utils.MobileReplyThreadsInputFieldData}
                        handleChange={(e) => handleChange({push_threads: e ? 'all' : 'mention'})}
                    />}
                </>
            )}
        </>
    );

    const autoFollowThreadsSectionContent = (
        <CheckboxSettingItem
            inputFieldTitle={
                <FormattedMessage
                    id='channel_notifications.checkbox.autoFollowThreadsTitle'
                    defaultMessage='Automatically follow threads in this channel'
                />
            }
            inputFieldValue={settings.channel_auto_follow_threads === 'on'}
            inputFieldData={utils.AutoFollowThreadsInputFieldData}
            handleChange={(e) => handleChange({channel_auto_follow_threads: e ? 'on' : 'off'})}
        />
    );

    const desktopAndMobileNotificationSectionContent = settings.mark_unread === 'all' ? (
        <>
            <div className='channel-notifications-settings-modal__divider'/>
            <ModalSection
                title={formatMessage({
                    id: 'channel_notifications.desktopNotificationsTitle',
                    defaultMessage: 'Desktop Notifications',
                })}
                titleSuffix={
                    <ResetToDefaultButton
                        sectionName={SectionName.Desktop}
                        userNotifyProps={props.currentUser.notify_props}
                        userSelectedChannelNotifyProps={settings}
                        onClick={handleResetToDefaultClicked}
                    />
                }
                description={formatMessage({
                    id: 'channel_notifications.desktopNotificationsDesc',
                    defaultMessage: 'Available on Chrome, Edge, Firefox, and the Mattermost Desktop App.',
                })}
                content={desktopNotificationsSectionContent}
            />
            <div className='channel-notifications-settings-modal__divider'/>
            <ModalSection
                title={formatMessage({
                    id: 'channel_notifications.mobileNotificationsTitle',
                    defaultMessage: 'Mobile Notifications',
                })}
                titleSuffix={
                    <ResetToDefaultButton
                        sectionName={SectionName.Mobile}
                        userNotifyProps={props.currentUser.notify_props}
                        userSelectedChannelNotifyProps={settings}
                        onClick={handleResetToDefaultClicked}
                    />
                }
                description={formatMessage({
                    id: 'channel_notifications.mobileNotificationsDesc',
                    defaultMessage: 'Notification alerts are pushed to your mobile device when there is activity in Mattermost.',
                })}
                content={mobileNotificationsSectionContent}
            />
        </>
    ) : (
        <AlertBanner
            id='channelNotificationsMutedBanner'
            mode='info'
            variant='app'
            customIcon={
                <BellOffOutlineIcon
                    size={24}
                    color={'currentColor'}
                />
            }
            title={
                <FormattedMessage
                    id='channel_notifications.alertBanner.title'
                    defaultMessage='This channel is muted'
                />
            }
            message={
                <FormattedMessage
                    id='channel_notifications.alertBanner.description'
                    defaultMessage='All other notification preferences for this channel are disabled'
                />
            }
        />
    );

    return (
        <Modal
            dialogClassName='a11y__modal channel-notifications-settings-modal'
            show={show}
            onHide={handleHide}
            onExited={props.onExited}
            role='dialog'
            aria-labelledby='channelNotificationModalLabel'
            style={{display: 'flex', placeItems: 'center'}}
        >
            <ModalHeader
                id={'channelNotificationModalLabel'}
                title={formatMessage({
                    id: 'channel_notifications.preferences',
                    defaultMessage: 'Notification Preferences',
                })}
                subtitle={props.channel.display_name}
                handleClose={handleHide}
            />
            <main className='channel-notifications-settings-modal__body'>
                <ModalSection
                    title={formatMessage({
                        id: 'channel_notifications.muteAndIgnore',
                        defaultMessage: 'Mute or ignore',
                    })}
                    content={muteOrIgnoreSectionContent}
                />
                {desktopAndMobileNotificationSectionContent}
                {props.collapsedReplyThreads &&
                    <>
                        <div className='channel-notifications-settings-modal__divider'/>
                        <ModalSection
                            title={formatMessage({
                                id: 'channel_notifications.autoFollowThreadsTitle',
                                defaultMessage: 'Follow all threads in this channel',
                            })}
                            description={formatMessage({
                                id: 'channel_notifications.autoFollowThreadsDesc',
                                defaultMessage: 'When enabled, all new replies in this channel will be automatically followed and will appear in your Threads view.',
                            })}
                            content={autoFollowThreadsSectionContent}
                        />
                    </>
                }
            </main>
            <footer className='channel-notifications-settings-modal__footer'>
                {serverError &&
                    <span className='channel-notifications-settings-modal__server-error'>
                        {serverError}
                    </span>
                }
                <button
                    className='btn btn-tertiary btn-md'
                    onClick={handleHide}
                >
                    <FormattedMessage
                        id='generic_btn.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
                <button
                    className='btn btn-primary btn-md'
                    onClick={handleSave}
                >
                    <FormattedMessage
                        id='generic_btn.save'
                        defaultMessage='Save'
                    />
                </button>
            </footer>
        </Modal>
    );
}

function getStateFromNotifyProps(currentUserNotifyProps: UserNotifyProps, channelMemberNotifyProps?: ChannelMembership['notify_props']): Omit<ChannelNotifyProps, 'email'> {
    return {
        mark_unread: channelMemberNotifyProps?.mark_unread || NotificationLevels.ALL,
        ignore_channel_mentions: getInitialValuesOfChannelNotifyProps('ignore_channel_mentions', currentUserNotifyProps, channelMemberNotifyProps),
        desktop: getInitialValuesOfChannelNotifyProps('desktop', currentUserNotifyProps, channelMemberNotifyProps),
        desktop_threads: getInitialValuesOfChannelNotifyProps('desktop_threads', currentUserNotifyProps, channelMemberNotifyProps),
        desktop_sound: getInitialValuesOfChannelNotifyProps('desktop_sound', currentUserNotifyProps, channelMemberNotifyProps),
        desktop_notification_sound: getInitialValuesOfChannelNotifyProps('desktop_notification_sound', currentUserNotifyProps, channelMemberNotifyProps),
        push: getInitialValuesOfChannelNotifyProps('push', currentUserNotifyProps, channelMemberNotifyProps),
        push_threads: getInitialValuesOfChannelNotifyProps('push_threads', currentUserNotifyProps, channelMemberNotifyProps),
        channel_auto_follow_threads: channelMemberNotifyProps?.channel_auto_follow_threads || 'off',
    };
}

/**
 * Function to get the initial values for the state corresponding to channel notification props.
 * This is not same as channel's notification props or user's notification props but values are determined based on both along with suitable defaults.
 */
export function getInitialValuesOfChannelNotifyProps<T extends keyof ChannelNotifyProps>(
    selectedNotifyProps: T,
    currentUserNotifyProps: UserNotifyProps,
    channelMemberNotifyProps?: ChannelMembership['notify_props']): ChannelNotifyProps[T] {
    if (selectedNotifyProps === 'desktop') {
        let desktop: ChannelNotifyProps['desktop'];

        if (channelMemberNotifyProps?.desktop) {
            // If the channel's 'desktop' setting is default, we should use the user's 'desktop' setting since its always set
            if (channelMemberNotifyProps.desktop === NotificationLevels.DEFAULT) {
                desktop = currentUserNotifyProps.desktop;
            } else {
                // Otherwise, we should use the channel's 'desktop' setting as is
                desktop = channelMemberNotifyProps.desktop;
            }
        } else {
            // If the channel's 'desktop' setting is not set, we should use the user's 'desktop' setting since thats always set
            desktop = currentUserNotifyProps.desktop;
        }

        return desktop as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'desktop_threads') {
        let desktopThreads: ChannelNotifyProps['desktop_threads'] = NotificationLevels.ALL;

        if (channelMemberNotifyProps?.desktop_threads) {
            // If the channel's 'desktop_threads' setting is default, we should use the user's 'desktop_threads' setting if its defined
            if (channelMemberNotifyProps.desktop_threads === NotificationLevels.DEFAULT && currentUserNotifyProps?.desktop_threads) {
                desktopThreads = currentUserNotifyProps.desktop_threads;
            } else {
                // Otherwise, we should use the channel's 'desktop_threads' setting as is
                desktopThreads = channelMemberNotifyProps.desktop_threads;
            }
        } else if (currentUserNotifyProps?.desktop_threads) {
            // If the channel's 'desktop_threads' setting is not set, we should use the user's 'desktop_threads' setting if its defined
            desktopThreads = currentUserNotifyProps.desktop_threads;
        }

        return desktopThreads as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'desktop_sound') {
        let desktopSound: ChannelNotifyProps['desktop_sound'];

        if (channelMemberNotifyProps?.desktop_sound) {
            desktopSound = channelMemberNotifyProps.desktop_sound;
        } else {
            desktopSound = convertDesktopSoundNotifyPropFromUserToDesktop(currentUserNotifyProps.desktop_sound);
        }

        return desktopSound as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'desktop_notification_sound') {
        let desktopNotificationSound: ChannelNotifyProps['desktop_notification_sound'];

        if (channelMemberNotifyProps?.desktop_notification_sound) {
            desktopNotificationSound = channelMemberNotifyProps.desktop_notification_sound;
        } else if (currentUserNotifyProps?.desktop_notification_sound) {
            desktopNotificationSound = currentUserNotifyProps.desktop_notification_sound;
        } else {
            desktopNotificationSound = notificationSoundKeys[0] as ChannelNotifyProps['desktop_notification_sound'];
        }

        return desktopNotificationSound as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'push') {
        let push: ChannelNotifyProps['push'];

        if (channelMemberNotifyProps?.push) {
            // If the channel's 'push' setting is default, we should use the user's 'push' setting since its always set
            if (channelMemberNotifyProps.push === NotificationLevels.DEFAULT) {
                push = currentUserNotifyProps.push;
            } else {
                // Otherwise, we should use the channel's 'push' setting as is
                push = channelMemberNotifyProps.push;
            }
        } else {
            // If the channel's 'push' setting is not set, we should use the user's 'push' setting since thats always set
            push = currentUserNotifyProps.push;
        }

        return push as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'push_threads') {
        let pushThreads: ChannelNotifyProps['push_threads'] = NotificationLevels.ALL;

        if (channelMemberNotifyProps?.push_threads) {
            // If the channel's 'push_threads' setting is default, we should use the user's 'push_threads' setting if its defined
            if (channelMemberNotifyProps.push_threads === NotificationLevels.DEFAULT && currentUserNotifyProps?.push_threads) {
                pushThreads = currentUserNotifyProps.push_threads;
            } else {
                // Otherwise, we should use the channel's 'push_threads' setting as is
                pushThreads = channelMemberNotifyProps.push_threads;
            }
        } else if (currentUserNotifyProps?.push_threads) {
            // If the channel's 'push_threads' setting is not set, we should use the user's 'push_threads' setting if its defined
            pushThreads = currentUserNotifyProps.push_threads;
        }

        return pushThreads as ChannelNotifyProps[T];
    }

    if (selectedNotifyProps === 'ignore_channel_mentions') {
        let ignoreChannelMentionsDefault: ChannelNotifyProps['ignore_channel_mentions'] = IgnoreChannelMentions.OFF;

        if (channelMemberNotifyProps?.mark_unread === NotificationLevels.MENTION || (currentUserNotifyProps.channel && currentUserNotifyProps.channel === 'false')) {
            ignoreChannelMentionsDefault = IgnoreChannelMentions.ON;
        }

        let ignoreChannelMentions = channelMemberNotifyProps?.ignore_channel_mentions;
        if (!ignoreChannelMentions || ignoreChannelMentions === IgnoreChannelMentions.DEFAULT) {
            ignoreChannelMentions = ignoreChannelMentionsDefault;
        }

        return ignoreChannelMentions as ChannelNotifyProps[T];
    }

    return undefined as ChannelNotifyProps[T];
}

export function createChannelNotifyPropsFromSelectedSettings(
    userNotifyProps: UserNotifyProps,
    savedChannelNotifyProps: ChannelMembership['notify_props'],
    collapsedReplyThreads: boolean,
    desktopAndMobileSettingsDifferent: boolean,
) {
    const channelNotifyProps: ChannelMembership['notify_props'] = {
        mark_unread: savedChannelNotifyProps.mark_unread,
        ignore_channel_mentions: savedChannelNotifyProps.ignore_channel_mentions,
        channel_auto_follow_threads: savedChannelNotifyProps.channel_auto_follow_threads,
    };

    if (savedChannelNotifyProps.desktop === userNotifyProps.desktop) {
        channelNotifyProps.desktop = NotificationLevels.DEFAULT;
    } else {
        channelNotifyProps.desktop = savedChannelNotifyProps.desktop;
    }

    if (savedChannelNotifyProps.desktop_threads === userNotifyProps.desktop_threads) {
        channelNotifyProps.desktop_threads = NotificationLevels.DEFAULT;
    } else {
        channelNotifyProps.desktop_threads = savedChannelNotifyProps.desktop_threads;
    }

    if (convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyProps?.desktop_sound) === savedChannelNotifyProps.desktop_sound) {
        // TODO: Check if this is correct
        channelNotifyProps.desktop_sound = undefined;
    } else {
        channelNotifyProps.desktop_sound = savedChannelNotifyProps.desktop_sound;
    }

    if (userNotifyProps && userNotifyProps.desktop_notification_sound) {
        // If user changed global notification sound, we should save the channel notification sound if it's different than the global one
        if (userNotifyProps.desktop_notification_sound === savedChannelNotifyProps.desktop_notification_sound) {
            // TODO: Check if this is correct
            channelNotifyProps.desktop_notification_sound = undefined;
        } else {
            channelNotifyProps.desktop_notification_sound = savedChannelNotifyProps.desktop_notification_sound;
        }
    } else if (savedChannelNotifyProps.desktop_notification_sound !== notificationSoundKeys[0]) {
        // If user never changed global notification sound and then we should only save the channel notification sound if it's not the default
        channelNotifyProps.desktop_notification_sound = savedChannelNotifyProps.desktop_notification_sound;
    }

    if (!desktopAndMobileSettingsDifferent) {
        channelNotifyProps.push = channelNotifyProps.desktop;
    } else if (savedChannelNotifyProps.push === userNotifyProps.push) {
        channelNotifyProps.push = NotificationLevels.DEFAULT;
    } else {
        channelNotifyProps.push = savedChannelNotifyProps.push;
    }

    if (!desktopAndMobileSettingsDifferent) {
        channelNotifyProps.push_threads = channelNotifyProps.desktop_threads;
    } else if (savedChannelNotifyProps.push_threads === userNotifyProps.push_threads) {
        channelNotifyProps.push_threads = NotificationLevels.DEFAULT;
    } else {
        channelNotifyProps.push_threads = savedChannelNotifyProps.push_threads;
    }

    if (!collapsedReplyThreads) {
        delete channelNotifyProps.desktop_threads;
        delete channelNotifyProps.push_threads;
        delete channelNotifyProps.channel_auto_follow_threads;
    }

    return channelNotifyProps;
}

/**
 * Check's if channel's global notification settings for desktop and mobile are different
 */
export function areDesktopAndMobileSettingsDifferent(
    isCollapsedThreadsEnabled: boolean,
    desktop?: UserNotifyProps['desktop'],
    push?: UserNotifyProps['push'],
    desktopThreads?: UserNotifyProps['desktop_threads'],
    pushThreads?: UserNotifyProps['push_threads'],
): boolean {
    function checkIfPushThreadsAreDifferent(pushThreads: UserNotifyProps['push_threads'], desktopThreads: UserNotifyProps['desktop_threads']) {
        if (!pushThreads) {
            return false;
        } else if (pushThreads === desktopThreads) {
            return false;
        }

        return true;
    }

    if (push === NotificationLevels.DEFAULT) {
        if (isCollapsedThreadsEnabled) {
            return checkIfPushThreadsAreDifferent(pushThreads, desktopThreads);
        }
        return false;
    } else if (desktop === push) {
        if (isCollapsedThreadsEnabled) {
            return checkIfPushThreadsAreDifferent(pushThreads, desktopThreads);
        }
        return false;
    }

    return true;
}
