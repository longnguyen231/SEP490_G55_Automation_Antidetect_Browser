import React from 'react';
import { Modal, Input, Select, Button, ConfigProvider, theme } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';

const schema = yup.object({
  name: yup.string().required('Profile name is required'),
  group: yup.string().required('Please select a group'),
  os: yup.string().required('Please select an OS'),
  proxy: yup.string().required('Please select a proxy type'),
}).required();

const CreateProfileModal = ({ isOpen, onClose, onSuccess }) => {
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: '',
      group: '',
      os: 'windows',
      proxy: 'none'
    }
  });

  const onSubmit = (data) => {
    console.log('Form Data:', data);
    toast.success('Profile created successfully!');
    reset();
    onSuccess(data);
    onClose();
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  return (
    <ConfigProvider theme={{ 
      algorithm: theme.darkAlgorithm, 
      token: { 
        colorBgContainer: '#1e293b', 
        colorBgElevated: '#0f172a',
        colorPrimary: '#00bcd4', 
        borderRadius: 8, 
        controlHeight: 40 
      } 
    }}>
      <Modal
        title={<span className="text-lg font-bold">Create New Profile</span>}
        open={isOpen}
        onCancel={handleCancel}
        footer={null}
        className="dark-modal"
        destroyOnClose
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-6">
          
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-300">Profile Name <span className="text-rose-500">*</span></label>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <div>
                  <Input {...field} placeholder="e.g., Facebook Ads Main" status={errors.name ? 'error' : ''} />
                  {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name.message}</p>}
                </div>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-300">Group <span className="text-rose-500">*</span></label>
              <Controller
                name="group"
                control={control}
                render={({ field }) => (
                  <div>
                    <Select 
                      {...field} 
                      className="w-full" 
                      placeholder="Select group"
                      status={errors.group ? 'error' : ''}
                      options={[
                        { value: 'marketing', label: 'Marketing' },
                        { value: 'social', label: 'Social' },
                        { value: 'main_team', label: 'Main Team' },
                      ]} 
                    />
                    {errors.group && <p className="text-rose-500 text-xs mt-1">{errors.group.message}</p>}
                  </div>
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-300">Operating System</label>
              <Controller
                name="os"
                control={control}
                render={({ field }) => (
                  <Select 
                    {...field} 
                    className="w-full"
                    options={[
                      { value: 'windows', label: 'Windows (Win 11)' },
                      { value: 'macos', label: 'macOS (Sonoma)' },
                      { value: 'linux', label: 'Linux (Ubuntu)' },
                    ]} 
                  />
                )}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-300">Proxy Setting</label>
            <Controller
              name="proxy"
              control={control}
              render={({ field }) => (
                <Select 
                  {...field} 
                  className="w-full"
                  options={[
                    { value: 'none', label: 'Without Proxy (Direct)' },
                    { value: 'http', label: 'HTTP / HTTPS' },
                    { value: 'socks5', label: 'SOCKS5' },
                  ]} 
                />
              )}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button onClick={handleCancel} className="font-semibold text-slate-300 border-slate-700 hover:text-white hover:border-slate-500">
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" className="font-semibold shadow-lg shadow-primary/20">
              Create Profile
            </Button>
          </div>
        </form>
      </Modal>
    </ConfigProvider>
  );
};

export default CreateProfileModal;
