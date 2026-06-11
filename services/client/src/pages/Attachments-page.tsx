import React from 'react'
import Attachments from '../components/Attachments'
import UploadAttachment from '../components/Upload-Attachment'

type Props = {}

const AttachmentPage = (props: Props) => {
  return (
    <div className='p-1 space-y-6'>
      <UploadAttachment/>
      <Attachments/>
    </div>
  )
}

export default AttachmentPage