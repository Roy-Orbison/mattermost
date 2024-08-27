// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';

import type {ChannelMembership} from '@mattermost/types/channels';
import type {UserNotifyProps} from '@mattermost/types/users';

import ChannelNotificationsModal, {createChannelNotifyPropsFromSelectedSettings} from 'components/channel_notifications_modal/channel_notifications_modal';
import type {Props} from 'components/channel_notifications_modal/channel_notifications_modal';

import {renderWithContext} from 'tests/react_testing_utils';
import {IgnoreChannelMentions, NotificationLevels} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

describe('ChannelNotificationsModal', () => {
    const baseProps: Props = {
        onExited: jest.fn(),
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            display_name: 'channel_display_name',
        }),
        channelMember: {
            notify_props: {
                desktop: NotificationLevels.ALL,
                desktop_sound: 'on',
                desktop_notification_sound: 'Bing',
                mark_unread: NotificationLevels.ALL,
                push: NotificationLevels.ALL,
                ignore_channel_mentions: IgnoreChannelMentions.DEFAULT,
                desktop_threads: NotificationLevels.ALL,
                push_threads: NotificationLevels.ALL,
            },
        } as unknown as ChannelMembership,
        currentUser: TestHelper.getUserMock({
            id: 'current_user_id',
            notify_props: {
                desktop: NotificationLevels.ALL,
                desktop_sound: 'true',
                desktop_notification_sound: 'Bing',
                desktop_threads: NotificationLevels.MENTION,
                push_threads: NotificationLevels.MENTION,
                push: NotificationLevels.MENTION,
            } as UserNotifyProps,
        }),
        sendPushNotifications: true,
        actions: {
            updateChannelNotifyProps: jest.fn().mockImplementation(() => Promise.resolve({data: true})),
        },
        collapsedReplyThreads: false,
    };

    test('should not show other settings if channel is mute', async () => {
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        const muteChannel = screen.getByTestId('muteChannel');

        fireEvent.click(muteChannel);
        expect(muteChannel).toBeChecked();
        const AlertBanner = screen.queryByText('This channel is muted');
        expect(AlertBanner).toBeVisible();

        expect(screen.queryByText('Desktop Notifications')).toBeNull();

        expect(screen.queryByText('Mobile Notifications')).toBeNull();
        expect(screen.queryByText('Follow all threads in this channel')).toBeNull();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));

        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'default',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'mention',
                    push: 'default',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should Ignore mentions for @channel, @here and @all', async () => {
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...baseProps}/>,
        );
        const ignoreChannel = screen.getByTestId('ignoreMentions');
        fireEvent.click(ignoreChannel);
        expect(ignoreChannel).toBeChecked();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'default',
                    ignore_channel_mentions: 'on',
                    mark_unread: 'all',
                    push: 'default',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should check the options in the desktop notifications', async () => {
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        expect(screen.queryByText('Desktop Notifications')).toBeVisible();

        const AlllabelRadio: HTMLInputElement = screen.getByTestId(
            'desktopNotification-all',
        );
        fireEvent.click(AlllabelRadio);
        expect(AlllabelRadio.checked).toEqual(true);

        const MentionslabelRadio: HTMLInputElement = screen.getByTestId(
            'desktopNotification-mention',
        );
        fireEvent.click(MentionslabelRadio);
        expect(MentionslabelRadio.checked).toEqual(true);

        const NothinglabelRadio: HTMLInputElement = screen.getByTestId(
            'desktopNotification-none',
        );
        fireEvent.click(NothinglabelRadio);
        expect(NothinglabelRadio.checked).toEqual(true);

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'none',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    push: 'none',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should disable message notification sound if option is unchecked', async () => {
        renderWithContext(<ChannelNotificationsModal {...baseProps}/>);

        // Since the default value is on, we will uncheck the checkbox
        fireEvent.click(screen.getByTestId('desktopNotificationSoundsCheckbox'));
        expect(screen.getByTestId('desktopNotificationSoundsCheckbox')).not.toBeChecked();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() => {
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'default',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    push: 'default',
                    desktop_sound: 'off',
                },
            );
        });
    });

    test('should default to user desktop notification sound if reset to default is clicked', async () => {
        renderWithContext(<ChannelNotificationsModal {...baseProps}/>);

        // Since the default value is on, we will uncheck the checkbox
        fireEvent.click(screen.getByTestId('desktopNotificationSoundsCheckbox'));
        expect(screen.getByTestId('desktopNotificationSoundsCheckbox')).not.toBeChecked();

        // Reset to default button is clicked
        fireEvent.click(screen.getByTestId('resetToDefaultButton-desktop'));

        // Verify that the checkbox is checked to default to user desktop notification sound
        expect(screen.getByTestId('desktopNotificationSoundsCheckbox')).toBeChecked();
    });

    test('should save the options exactly same as Desktop for mobile if use same as desktop checkbox is checked', async () => {
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        expect(screen.queryByText('Desktop Notifications')).toBeVisible();

        const sameAsDesktop: HTMLInputElement = screen.getByTestId(
            'sameMobileSettingsDesktop',
        );
        expect(sameAsDesktop.checked).toEqual(true);

        expect(screen.queryByText('All new messages')).toBeNull();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'default',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    push: 'default',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should check the options in the mobile notifications', async () => {
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        const AlllabelRadio: HTMLInputElement = screen.getByTestId(
            'MobileNotification-all',
        );
        fireEvent.click(AlllabelRadio);
        expect(AlllabelRadio.checked).toEqual(true);

        const MentionslabelRadio: HTMLInputElement = screen.getByTestId(
            'MobileNotification-mention',
        );
        fireEvent.click(MentionslabelRadio);
        expect(MentionslabelRadio.checked).toEqual(true);

        const NothinglabelRadio: HTMLInputElement = screen.getByTestId(
            'MobileNotification-none',
        );
        fireEvent.click(NothinglabelRadio);
        expect(NothinglabelRadio.checked).toEqual(true);

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'default',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    push: 'none',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should show auto follow, desktop threads and mobile threads settings if collapsed reply threads is enabled', async () => {
        const props = {
            ...baseProps,
            collapsedReplyThreads: true,
        };
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...props}/>,
        );

        expect(screen.queryByText('Follow all threads in this channel')).toBeVisible();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));

        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'default',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    channel_auto_follow_threads: 'off',
                    push: 'default',
                    push_threads: 'default',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });
});

describe('createChannelNotifyPropsFromSelectedSettings', () => {
    test('should return passed in mark_unread, ignore_channel_mentions, channel_auto_follow_threads', () => {
        const userNotifyProps = TestHelper.getUserMock().notify_props;
        const savedChannelNotifyProps = TestHelper.getChannelMembershipMock({
            notify_props: {
                mark_unread: 'all',
                ignore_channel_mentions: 'off',
                channel_auto_follow_threads: 'off',
            },
        }).notify_props;

        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps, savedChannelNotifyProps, true, true);
        expect(channelNotifyProps.mark_unread).toEqual('all');
        expect(channelNotifyProps.ignore_channel_mentions).toEqual('off');
        expect(channelNotifyProps.channel_auto_follow_threads).toEqual('off');
    });

    test('should return default if channel\'s desktop is same as user\'s desktop value', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop: 'all',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: 'all',
            },
        }).notify_props;

        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true, true);
        expect(channelNotifyProps1.desktop).toEqual('default');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                desktop: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: 'mention',
            },
        }).notify_props;

        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true, true);
        expect(channelNotifyProps2.desktop).toEqual('default');
    });

    test('should return desktop value if channel\'s desktop is different from user\'s desktop value', () => {
        const userNotifyProps = TestHelper.getUserMock({
            notify_props: {
                desktop: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: 'all',
            },
        }).notify_props;

        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps, savedChannelNotifyProps, true, true);
        expect(channelNotifyProps.desktop).toEqual('all');
    });

    test('should return desktop_threads value if channel\'s desktop_threads is different from user\'s desktop_threads value', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop_threads: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'all',
            },
        }).notify_props;

        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true, true);
        expect(channelNotifyProps1.desktop_threads).toEqual('all');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'all',
            },
        }).notify_props;

        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true, true);
        expect(channelNotifyProps2.desktop_threads).toEqual('all');
    });

    test('should return default value if channel\'s desktop_threads is same as user\'s desktop_threads value', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop_threads: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'mention',
            },
        }).notify_props;

        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true, true);
        expect(channelNotifyProps1.desktop_threads).toEqual('default');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {},
        }).notify_props;

        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true, true);
        expect(channelNotifyProps2.desktop_threads).toEqual('default');
    });

    test('should return desktop_sound value if channel\'s desktop_sound is different from user\'s desktop_sound value', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop_sound: 'true',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: 'off',
            },
        }).notify_props;

        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true, true);
        expect(channelNotifyProps1.desktop_sound).toEqual('off');

        const userNotifyProps2 = {} as UserNotifyProps;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: 'off',
            },
        }).notify_props;

        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true, true);
        expect(channelNotifyProps2.desktop_sound).toEqual('off');
    });

    test('should not return desktop_sound value if channel\'s desktop_sound is same as user\'s desktop_sound value', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop_sound: 'true',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: 'on',
            },
        }).notify_props;

        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true, true);
        expect(channelNotifyProps1.desktop_sound).toBeUndefined();

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                desktop_sound: 'false',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: 'off',
            },
        }).notify_props;

        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true, true);
        expect(channelNotifyProps2.desktop_sound).toBeUndefined();
    });

    test('should not return desktop_sound On if user never set their user setting desktop_sound but channel setting is on', () => {
        const userNotifyProps = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: 'on',
            },
        }).notify_props;

        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps, savedChannelNotifyProps, true, true);
        expect(channelNotifyProps.desktop_sound).toBeUndefined();
    });

    test('should not return desktop_notification_sound for channel if its BING and user never set their user setting desktop_notification_sound', () => {
        const userNotifyProps = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_notification_sound: 'Bing',
            },
        }).notify_props;

        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps, savedChannelNotifyProps, true, true);
        expect(channelNotifyProps.desktop_notification_sound).toBeUndefined();
    });

    test('should not return desktop_notification_sound for channel if its BING and user set their user setting desktop_notification_sound as BING', () => {
        const userNotifyProps = TestHelper.getUserMock({
            notify_props: {
                desktop_notification_sound: 'Bing',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_notification_sound: 'Bing',
            },
        }).notify_props;

        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps, savedChannelNotifyProps, true, true);
        expect(channelNotifyProps.desktop_notification_sound).toBeUndefined();
    });

    test('should return desktop_notification_sound for channel if its different than user\'s desktop_notification_sound', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop_notification_sound: 'Bing',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_notification_sound: 'Crackle',
            },
        }).notify_props;

        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true, true);
        expect(channelNotifyProps.desktop_notification_sound).toEqual('Crackle');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_notification_sound: 'Down',
            },
        }).notify_props;

        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true, true);
        expect(channelNotifyProps2.desktop_notification_sound).toEqual('Down');
    });

    test('should not return desktop_threads value if collapsed reply threads is enabled', () => {
        const userNotifyProps = TestHelper.getUserMock({
            notify_props: {
                desktop_threads: 'mention',
                push_threads: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'mention',
                push_threads: 'mention',
                channel_auto_follow_threads: 'on',
            },
        }).notify_props;

        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps, savedChannelNotifyProps, false, true);
        expect(channelNotifyProps.desktop_threads).toBeUndefined();
        expect(channelNotifyProps.push_threads).toBeUndefined();
        expect(channelNotifyProps.channel_auto_follow_threads).toBeUndefined();
    });

    test('should return default for push if user selected the desktop and mobile to be the same', () => {
        const userNotifyProps = TestHelper.getUserMock({
            notify_props: {
                push: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps = TestHelper.getChannelMembershipMock({
            notify_props: {
                push: 'all',
            },
        }).notify_props;

        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps, savedChannelNotifyProps, true, false);
        expect(channelNotifyProps.push).toEqual('default');
    });

    test('should not return push_threads value if user selected the desktop and mobile to be the same', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                push: 'mention',
                push_threads: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                push: 'all',
                push_threads: 'all',
            },
        }).notify_props;
        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true, false);
        expect(channelNotifyProps1.push).toEqual('default');
        expect(channelNotifyProps1.push_threads).toEqual('default');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                push: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                push: 'all',
                push_threads: 'all',
            },
        }).notify_props;
        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true, false);
        expect(channelNotifyProps2.push).toEqual('default');
        expect(channelNotifyProps2.push_threads).toEqual('default');

        const userNotifyProps3 = TestHelper.getUserMock({
            notify_props: {
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps3 = TestHelper.getChannelMembershipMock({
            notify_props: {
                push: 'all',
                push_threads: 'all',
            },
        }).notify_props;
        const channelNotifyProps3 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps3, savedChannelNotifyProps3, true, false);
        expect(channelNotifyProps3.push).toEqual('default');
        expect(channelNotifyProps3.push_threads).toEqual('default');

        const userNotifyProps4 = TestHelper.getUserMock({
            notify_props: {
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps4 = TestHelper.getChannelMembershipMock({
            notify_props: {
                push: 'all',
            },
        }).notify_props;
        const channelNotifyProps4 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps4, savedChannelNotifyProps4, true, false);
        expect(channelNotifyProps4.push).toEqual('default');
        expect(channelNotifyProps4.push_threads).toEqual('default');
    });
});
