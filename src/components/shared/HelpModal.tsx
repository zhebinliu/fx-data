import React from 'react';
import { Modal, Typography, Steps, Image, Link, Divider } from '@arco-design/web-react';

const { Title, Paragraph, Text } = Typography;
const Step = Steps.Step;

interface HelpModalProps {
    visible: boolean;
    onCancel: () => void;
}

export function HelpModal({ visible, onCancel }: HelpModalProps) {
    return (
        <Modal
            title="如何获取配置信息？"
            visible={visible}
            onOk={onCancel}
            onCancel={onCancel}
            okText="我已了解"
            hideCancel
            style={{ width: 800 }}
        >
            <Typography>
                <Paragraph>
                    要使用此工具，您需要在纷享销客（FxCRM）后台创建一个“自建应用”以获取必要的 API 凭证。
                </Paragraph>

                <Title heading={6}>第一步：创建自建应用</Title>
                <div className="mb-4">
                    <Steps direction="vertical" lineless>
                        <Step title="登录后台" description="使用管理员账号登录纷享销客 Web 端后台。" />
                        <Step title="进入应用管理" description="导航至 [管理后台] -> [系统集成] -> [开发平台] -> [自建应用]。" />
                        <Step title="新建应用" description="点击“新建应用”，填写应用名称（如“数据导入工具”），应用类型选择“企业内部应用”。" />
                    </Steps>
                </div>

                <Divider />

                <Title heading={6}>第二步：获取 App ID 和 App Secret</Title>
                <Paragraph>
                    应用创建成功后，点击应用详情，您可以看到 <Text bold>App ID</Text> 和 <Text bold>App Secret</Text>。
                    <br />
                    <Text type="secondary">请妥善保管 App Secret，不要泄露给他人。</Text>
                </Paragraph>

                <Divider />

                <Title heading={6}>第三步：获取 Permanent Code (永久授权码)</Title>
                <Paragraph>
                    在应用详情页的“授权管理”部分：
                </Paragraph>
                <ol className="list-decimal pl-5 mb-4">
                    <li>点击“设置授权范围”，确保勾选了所需的 API 权限（如 CRM 数据管理、用户管理等）。</li>
                    <li>在“API 授权”或“永久授权码”部分，点击生成或查看 <code>Permanent Code</code>。</li>
                    <li>注意：此码用于免登录调用接口，权限等同于授权管理员。</li>
                </ol>

                <Divider />

                <Title heading={6}>第四步：获取 OpenUserId</Title>
                <Paragraph>
                    OpenUserId 是操作用户的唯一标识。
                </Paragraph>
                <ul>
                    <li><Text bold>推荐方法：</Text> 在本工具配置页面下方，输入您的 FxCRM 账号绑定手机号，点击“查询 ID”自动获取。</li>
                </ul>

                <div className="bg-gray-100 p-4 rounded mt-4">
                    <Text type="warning">
                        注意：请确保配置的“操作用户”具有读写目标数据的权限。
                    </Text>
                </div>
            </Typography>
        </Modal>
    );
}
